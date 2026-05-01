import { NextRequest } from "next/server";
import { isBadSessionError } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PollRequestBody = {
  sessionId: string;
  /** ISO 时间戳。后续轮询拉 created_at 严格大于此值的事件 */
  afterCreatedAt?: string | null;
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

const ANTHROPIC_BASE = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";

/**
 * POST /api/chat/events
 * 客户端按 ~1.5s 一次轮询 Anthropic events.list 取增量事件。
 *
 * Cursor 用 created_at[gt]——这是 events.list 实际支持的语义；之前用
 * after_id 会被 API 拒绝 (Unknown query parameter 'after_id')。
 *
 * 由于 SDK 类型签名对 created_at[gt] 这种 bracket key 支持不一致，
 * 这里直接走 raw fetch 调 REST API，同时省掉一次 SDK 反序列化。
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

  const url = new URL(
    `/v1/sessions/${encodeURIComponent(body.sessionId)}/events`,
    ANTHROPIC_BASE,
  );
  url.searchParams.set("limit", "200");
  if (body.afterCreatedAt) {
    url.searchParams.set("created_at[gt]", body.afterCreatedAt);
  }

  let httpResp: Response;
  try {
    httpResp = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "managed-agents-2026-04-01",
      },
    });
  } catch (err) {
    return Response.json({
      events: [],
      lastCreatedAt: body.afterCreatedAt ?? null,
      isDone: true,
      isError: true,
      errorMessage: `网络错误：${err instanceof Error ? err.message : "未知"}`,
      invalidateSession: false,
    });
  }

  if (!httpResp.ok) {
    const errBody = (await httpResp.json().catch(() => ({}))) as {
      error?: { message?: string; type?: string };
    };
    const apiMsg =
      errBody.error?.message ?? `events.list 调用失败 (HTTP ${httpResp.status})`;
    const fakeErr = {
      status: httpResp.status,
      message: apiMsg,
      error: { error: { message: apiMsg } },
    };
    return Response.json({
      events: [],
      lastCreatedAt: body.afterCreatedAt ?? null,
      isDone: true,
      isError: true,
      errorMessage: apiMsg,
      invalidateSession: isBadSessionError(fakeErr),
    });
  }

  const result = (await httpResp.json()) as { data?: unknown };
  const raw: Array<Record<string, unknown>> = Array.isArray(result.data)
    ? (result.data as Array<Record<string, unknown>>)
    : [];

  // 按 created_at 升序，确保 delta 拼接顺序正确
  const ascending = [...raw].sort((a, b) => {
    const ta = (a.created_at as string) ?? "";
    const tb = (b.created_at as string) ?? "";
    return ta.localeCompare(tb);
  });

  const out: ClientEvent[] = [];
  let isDone = false;
  let isError = false;
  let errorMessage: string | null = null;
  let lastCreatedAt = body.afterCreatedAt ?? null;

  for (const event of ascending) {
    const eId = readString(event, "id");
    const type = readString(event, "type") ?? "";
    const ca = readString(event, "created_at");
    if (ca) lastCreatedAt = ca;

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
        if (eId) out.push({ id: eId, type: "status", text: `⚠️ ${friendly}` });
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
    lastCreatedAt,
    isDone,
    isError,
    errorMessage,
  });
}
