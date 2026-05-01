import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SendRequestBody = {
  agentId: string;
  sessionId?: string;
  message: string;
};

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
  let lastEventIdBeforeSend: string | null = null;
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
    } catch (err) {
      const { message: m, status } = describeApiError(err);
      return jsonError(status, `创建 Session 失败：${m}`);
    }
  } else {
    // 已有 session：取最新事件 id，让客户端从这里之后开始轮询，
    // 避免把历史事件再灌一遍
    try {
      const list = await client.beta.sessions.events.list(sessionId, {
        limit: 1,
      });
      const data = (list as { data?: Array<{ id?: string }> }).data ?? [];
      if (data[0]?.id) lastEventIdBeforeSend = data[0].id;
    } catch (err) {
      // 拿不到历史最大 id 不致命，客户端按 null cursor 兜底
      console.warn("[/api/chat] events.list pre-send failed", err);
    }
  }

  let sentEventId: string | null = null;
  try {
    const resp = (await client.beta.sessions.events.send(sessionId!, {
      events: [
        {
          type: "user.message",
          content: [{ type: "text", text: message }],
        },
      ],
    })) as { events?: Array<{ id?: string }> };
    sentEventId = resp?.events?.[0]?.id ?? null;
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
    lastEventIdBeforeSend,
    vaultIds: vaultIds ?? null,
  });
}
