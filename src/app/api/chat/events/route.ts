import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { isBadSessionError } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PollRequestBody = {
  sessionId: string;
  afterEventId?: string | null;
};

const NON_FATAL_ERRORS = new Set([
  "mcp_authentication_failed_error",
  "mcp_initialize_failed_error",
  "mcp_connection_failed_error",
]);

function friendlyErrorMessage(type: string, message: string): string {
  if (type === "mcp_authentication_failed_error") {
    return "GitHub / 第三方 MCP 未授权（已跳过；如需启用请去 Console 配置对应 Vault）";
  }
  if (type === "mcp_initialize_failed_error") return "MCP Server 初始化失败（已跳过）";
  if (type === "mcp_connection_failed_error") return "MCP Server 连接失败（已跳过）";
  if (type === "model_rate_limited_error") {
    return `Anthropic API 限流：${message || "请稍后重试"}。频繁出现请检查 Console 配额或换 Sonnet/Haiku。`;
  }
  if (type === "model_overloaded_error")
    return `模型当前过载：${message || "请稍后重试"}`;
  if (type === "model_error") return `模型执行出错：${message || "未知"}`;
  return `Session 错误 (${type})${message ? `：${message}` : ""}`;
}

function readString(o: unknown, key: string): string | undefined {
  if (o && typeof o === "object" && key in o) {
    const v = (o as Record<string, unknown>)[key];
    return typeof v === "string" ? v : undefined;
  }
  return undefined;
}

function extractSessionError(event: Record<string, unknown>): {
  type: string;
  message: string;
} {
  const errorObj = event.error as Record<string, unknown> | undefined;
  if (errorObj && typeof errorObj === "object") {
    return {
      type: readString(errorObj, "type") ?? "unknown",
      message: readString(errorObj, "message") ?? "",
    };
  }
  return {
    type:
      readString(event, "error_type") ?? readString(event, "code") ?? "unknown",
    message: readString(event, "message") ?? "",
  };
}

type ClientEvent =
  | { id: string; type: "delta"; text: string }
  | { id: string; type: "status"; text: string };

function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

/**
 * POST /api/chat/events
 * 客户端按 ~1.5s 一次轮询。每次调用 events.list 拉 cursor 之后的新事件，
 * 服务端把 agent.* 事件转换成前端可直接使用的 { type: "delta"|"status", text }。
 *
 * Request:  { sessionId, afterEventId? }
 * Response: { events: ClientEvent[], lastEventId, isDone, isError, errorMessage? }
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return jsonError(500, "缺少 ANTHROPIC_API_KEY 环境变量。");

  let body: PollRequestBody;
  try {
    body = (await req.json()) as PollRequestBody;
  } catch {
    return jsonError(400, "请求体不是合法 JSON。");
  }
  if (!body.sessionId) return jsonError(400, "缺少 sessionId。");

  const client = new Anthropic({ apiKey });

  // events.list 默认按时间倒序返回。我们要拿「自 cursor 之后的所有新事件」，
  // 用 after_id 做 forward 游标拉取。
  const listParams: Record<string, unknown> = { limit: 200 };
  if (body.afterEventId) listParams.after_id = body.afterEventId;

  let raw: Array<Record<string, unknown>>;
  try {
    const resp = (await client.beta.sessions.events.list(
      body.sessionId,
      listParams as Parameters<
        typeof client.beta.sessions.events.list
      >[1],
    )) as unknown as { data?: unknown };
    const data = Array.isArray(resp.data) ? resp.data : [];
    raw = data as Array<Record<string, unknown>>;
  } catch (err) {
    const e = err as {
      status?: number;
      error?: { error?: { message?: string } };
      message?: string;
    };
    const apiMsg =
      e.error?.error?.message ?? e.message ?? "events.list 调用失败";
    // 200 响应携带 isError，避免客户端走「网络故障退避重试」路径。
    // 同时带上 invalidateSession 让客户端清理坏 session 并自动重建。
    return Response.json({
      events: [],
      lastEventId: body.afterEventId ?? null,
      isDone: true,
      isError: true,
      errorMessage: apiMsg,
      invalidateSession: isBadSessionError(err),
    });
  }

  // 部分 Anthropic 列表端点返回的是 newest-first，统一翻成时间正序
  // 通过对 sevt_*** 这种自增 id 做字典序比较是不可靠的；这里假设 SDK
  // 按 created_at 已排序——但保险起见反一次（如果 SDK 已经是正序，
  // 客户端会按 lastEventId 过滤掉旧的，不会出错）。
  const newest = raw[0];
  const last = raw[raw.length - 1];
  const ascending: Array<Record<string, unknown>> =
    raw.length > 1 &&
    typeof newest?.created_at === "string" &&
    typeof last?.created_at === "string" &&
    (newest.created_at as string) > (last.created_at as string)
      ? [...raw].reverse()
      : raw;

  const out: ClientEvent[] = [];
  let isDone = false;
  let isError = false;
  let errorMessage: string | null = null;
  let lastEventId: string | null = body.afterEventId ?? null;

  for (const event of ascending) {
    const eId = readString(event, "id");
    const type = readString(event, "type") ?? "";
    if (eId) lastEventId = eId;

    if (type === "agent.message") {
      const content = (event.content as Array<Record<string, unknown>>) ?? [];
      const texts: string[] = [];
      for (const block of content) {
        if (block.type === "text" && typeof block.text === "string") {
          texts.push(block.text);
        }
      }
      if (texts.length > 0 && eId) {
        out.push({ id: eId, type: "delta", text: texts.join("") });
      }
      continue;
    }

    if (type === "agent.thinking") {
      if (eId) out.push({ id: eId, type: "status", text: "思考中…" });
      continue;
    }

    if (type === "agent.tool_use") {
      const tool = readString(event, "tool_name") ?? "工具";
      if (eId) out.push({ id: eId, type: "status", text: `调用 ${tool}…` });
      continue;
    }

    if (type === "agent.tool_result") {
      if (eId) out.push({ id: eId, type: "status", text: "工具完成" });
      continue;
    }

    if (type === "agent.mcp_tool_use") {
      const server = readString(event, "mcp_server_name") ?? "";
      const tool = readString(event, "tool_name") ?? "";
      if (eId)
        out.push({
          id: eId,
          type: "status",
          text: `MCP${server ? ` · ${server}` : ""}${tool ? ` · ${tool}` : ""}…`,
        });
      continue;
    }

    if (type === "agent.mcp_tool_result") {
      if (eId) out.push({ id: eId, type: "status", text: "MCP 完成" });
      continue;
    }

    if (type === "agent.thread_context_compacted") {
      if (eId) out.push({ id: eId, type: "status", text: "上下文压缩中…" });
      continue;
    }

    if (type === "session.error") {
      const { type: errType, message: errMsg } = extractSessionError(event);
      const friendly = friendlyErrorMessage(errType, errMsg);
      if (NON_FATAL_ERRORS.has(errType)) {
        if (eId)
          out.push({ id: eId, type: "status", text: `⚠️ ${friendly}` });
        continue;
      }
      isError = true;
      errorMessage = friendly;
      isDone = true;
      continue;
    }

    if (type === "session.status_rescheduled") {
      if (eId)
        out.push({ id: eId, type: "status", text: "已被自动重排队，稍候…" });
      continue;
    }

    if (type === "session.status_terminated") {
      isDone = true;
      continue;
    }

    if (type === "session.status_idle") {
      const stopReason = readString(
        event.stop_reason as Record<string, unknown> | undefined,
        "type",
      );
      if (stopReason && stopReason !== "requires_action") {
        isDone = true;
      }
      continue;
    }
  }

  return Response.json({
    events: out,
    lastEventId,
    isDone,
    isError,
    errorMessage,
  });
}
