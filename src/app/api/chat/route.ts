import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANTHROPIC_BASE =
  process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";

type SendRequestBody = {
  agentId: string;
  sessionId?: string;
  message: string;
};

/**
 * 在 events.send 之前，查一次 events.list 拿当前 session 最大 created_at。
 * 这个时间戳就是「用户消息发送之前的最新事件」，用作客户端轮询的初始游标。
 *
 * 不依赖 events.send 响应里的 created_at —— 该字段在 SDK 不同版本里结构
 * 不一致，可能为 undefined，会让 cursor 退化为 null 把所有历史事件再灌一遍。
 */
async function fetchSessionCursor(
  sessionId: string,
  apiKey: string,
): Promise<string | null> {
  try {
    const url = new URL(
      `/v1/sessions/${encodeURIComponent(sessionId)}/events`,
      ANTHROPIC_BASE,
    );
    url.searchParams.set("limit", "50");

    const r = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "managed-agents-2026-04-01",
      },
    });
    if (!r.ok) {
      console.warn("[/api/chat] fetchSessionCursor HTTP", r.status);
      return null;
    }
    const j = (await r.json()) as {
      data?: Array<{ created_at?: string }>;
    };
    const data = j.data ?? [];
    if (data.length === 0) return null;

    // 不假设排序方向，取所有事件 created_at 的最大值
    let max: string | null = null;
    for (const e of data) {
      const ca = e.created_at;
      if (ca && (!max || ca > max)) max = ca;
    }
    return max;
  } catch (err) {
    console.warn("[/api/chat] fetchSessionCursor error", err);
    return null;
  }
}

let cachedEnvironmentId: string | null = null;

function getVaultIds(): string[] | undefined {
  const raw = process.env.ANTHROPIC_VAULT_IDS;
  if (!raw) return undefined;
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}

async function getEnvironmentId(client: Anthropic): Promise<string> {
  if (process.env.ANTHROPIC_ENVIRONMENT_ID) {
    return process.env.ANTHROPIC_ENVIRONMENT_ID;
  }
  if (cachedEnvironmentId) return cachedEnvironmentId;

  const env = await client.beta.environments.create({
    name: `lixiaohai-${Date.now()}`,
    config: {
      type: "cloud",
      networking: { type: "unrestricted" },
    },
  });
  cachedEnvironmentId = env.id;
  return env.id;
}

function jsonError(status: number, message: string, extra?: unknown) {
  return Response.json({ error: message, detail: extra }, { status });
}

function describeApiError(err: unknown): { message: string; status: number } {
  if (err && typeof err === "object" && "status" in err) {
    const e = err as {
      status?: number;
      error?: { error?: { message?: string } };
      message?: string;
      request_id?: string;
    };
    const apiMsg = e.error?.error?.message ?? e.message ?? "Anthropic API 调用失败";
    const rid = e.request_id ? ` · request_id ${e.request_id}` : "";
    return {
      message: `${apiMsg}${rid}`,
      status: typeof e.status === "number" ? e.status : 500,
    };
  }
  if (err instanceof Error) return { message: err.message, status: 500 };
  return { message: "未知错误", status: 500 };
}

// 判定一个 Anthropic 错误是否说明「这个 session 已经不可用了」——
// 包括 archive / delete / not found / 状态冲突。前端拿到此标记后会
// 清掉本地 sessionId 并自动用新 session 重试。
export function isBadSessionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    status?: number;
    error?: { error?: { message?: string } };
    message?: string;
  };
  const status = e.status;
  const msg = (e.error?.error?.message ?? e.message ?? "").toLowerCase();
  return (
    status === 404 ||
    status === 409 ||
    msg.includes("archived") ||
    msg.includes("not found") ||
    msg.includes("deleted") ||
    msg.includes("does not exist") ||
    msg.includes("cannot send events")
  );
}

/**
 * POST /api/chat
 * 短请求：创建（或复用）session，发送 user.message，立刻返回。
 * 不再使用 SSE 长连接，避免 Netlify Function 超时。
 *
 * Request:  { agentId, sessionId?, message }
 * Response: { sessionId, sentEventId, lastEventIdBeforeSend, vaultIds }
 *
 * 客户端拿到 sessionId 后，调用 /api/chat/events 轮询拉新事件。
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonError(500, "缺少 ANTHROPIC_API_KEY 环境变量。");
  }

  let body: SendRequestBody;
  try {
    body = (await req.json()) as SendRequestBody;
  } catch {
    return jsonError(400, "请求体不是合法 JSON。");
  }

  const { agentId, sessionId: existingSessionId, message } = body;
  if (!agentId || !message?.trim()) {
    return jsonError(400, "缺少 agentId 或 message。");
  }

  const client = new Anthropic({ apiKey });

  let sessionId = existingSessionId;
  let cursorCreatedAt: string | null = null;
  const vaultIds = getVaultIds();

  if (!sessionId) {
    let environmentId: string;
    try {
      environmentId = await getEnvironmentId(client);
    } catch (err) {
      const { message: m, status } = describeApiError(err);
      return jsonError(status, `创建 Environment 失败：${m}`);
    }

    try {
      console.log("[/api/chat] sessions.create", {
        agentId,
        environmentId,
        vaultIds:
          vaultIds ?? "(env ANTHROPIC_VAULT_IDS not set — MCP will fail)",
      });
      const session = await client.beta.sessions.create({
        agent: { type: "agent", id: agentId },
        environment_id: environmentId,
        ...(vaultIds && { vault_ids: vaultIds }),
      });
      sessionId = session.id;
      // 新建 session 没有任何历史事件，cursor 保持 null，下游轮询不带过滤
    } catch (err) {
      const { message: m, status } = describeApiError(err);
      return jsonError(status, `创建 Session 失败：${m}`);
    }
  } else {
    // 已有 session：先 events.list 拿当前最大 created_at 作为初始游标
    cursorCreatedAt = await fetchSessionCursor(sessionId, apiKey);
    console.log(
      "[/api/chat] reuse session, pre-send cursor",
      cursorCreatedAt,
    );
  }

  let sentEventId: string | null = null;
  let sentCreatedAt: string | null = null;
  try {
    const resp = (await client.beta.sessions.events.send(sessionId!, {
      events: [
        {
          type: "user.message",
          content: [{ type: "text", text: message }],
        },
      ],
    })) as { events?: Array<{ id?: string; created_at?: string }> };
    sentEventId = resp?.events?.[0]?.id ?? null;
    sentCreatedAt = resp?.events?.[0]?.created_at ?? null;
  } catch (err) {
    const { message: m, status } = describeApiError(err);
    return jsonError(status, `发送消息失败：${m}`, {
      sessionId,
      invalidateSession: isBadSessionError(err),
    });
  }

  return Response.json({
    sessionId,
    sentEventId,
    sentCreatedAt,
    // 客户端用这个做初始轮询游标。新 session 时是 null（拉所有事件），
    // 已有 session 时是「发送之前的最大 created_at」（只拉之后的新事件）
    cursorCreatedAt,
    vaultIds: vaultIds ?? null,
  });
}
