import type { PollResponse, SendResponse } from "./chat-types";

/** 自定义 Error，附带服务端返回的 invalidateSession 标记 */
export class ChatApiError extends Error {
  invalidateSession?: boolean;
  status?: number;
  constructor(
    message: string,
    opts?: { invalidateSession?: boolean; status?: number },
  ) {
    super(message);
    this.name = "ChatApiError";
    this.invalidateSession = opts?.invalidateSession;
    this.status = opts?.status;
  }
}

export async function sendMessageReq(
  body: { agentId: string; sessionId: string | null; message: string },
  signal?: AbortSignal,
): Promise<SendResponse> {
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify(body),
  });
  const data = (await r.json()) as SendResponse;
  if (!r.ok) {
    throw new ChatApiError(data.error || `HTTP ${r.status}`, {
      invalidateSession: data.detail?.invalidateSession,
      status: r.status,
    });
  }
  return data;
}

export async function pollEventsReq(
  body: { sessionId: string; afterCreatedAt: string | null },
  signal?: AbortSignal,
): Promise<PollResponse> {
  const r = await fetch("/api/chat/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify(body),
  });
  const data = (await r.json()) as PollResponse;
  // 服务端正常错误也返回 200 + isError，所以非 200 才算"传输级故障"
  if (!r.ok && !Array.isArray(data.events)) {
    throw new ChatApiError(data.error || `HTTP ${r.status}`, {
      status: r.status,
    });
  }
  return data;
}
