import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatRequestBody = {
  agentId: string;
  sessionId?: string;
  message: string;
};

type Step = "environment" | "session" | "stream" | "send";

const HEARTBEAT_MS = 15_000;
const INACTIVITY_TIMEOUT_MS = 90_000;

let cachedEnvironmentId: string | null = null;

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

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function describeError(step: Step, err: unknown): {
  message: string;
  status: number | null;
} {
  const stepLabel: Record<Step, string> = {
    environment: "创建 Environment",
    session: "创建 Session",
    stream: "打开事件流",
    send: "发送消息",
  };

  if (err && typeof err === "object" && "status" in err) {
    const e = err as {
      status?: number;
      error?: { error?: { message?: string } };
      message?: string;
      request_id?: string;
    };
    const apiMsg = e.error?.error?.message ?? e.message ?? "未知错误";
    const rid = e.request_id ? ` · request_id ${e.request_id}` : "";
    return {
      message: `${stepLabel[step]}失败 (HTTP ${e.status ?? "?"}): ${apiMsg}${rid}`,
      status: e.status ?? null,
    };
  }
  if (err instanceof Error) {
    return { message: `${stepLabel[step]}失败：${err.message}`, status: null };
  }
  return { message: `${stepLabel[step]}失败：未知错误`, status: null };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonError(
      500,
      "缺少 ANTHROPIC_API_KEY 环境变量，请在服务器的 .env.local 中配置。",
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return jsonError(400, "请求体不是合法 JSON。");
  }

  const { agentId, sessionId: existingSessionId, message } = body;
  if (!agentId || !message?.trim()) {
    return jsonError(400, "缺少 agentId 或 message。");
  }

  const client = new Anthropic({ apiKey });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

      const enqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* controller already closed */
        }
      };

      const send = (event: string, data: unknown) => {
        enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      // SSE 注释行（: 开头）作为心跳，保持中间 proxy 不会因 idle 切断长连接。
      const heartbeatTick = () => enqueue(`: ping ${Date.now()}\n\n`);

      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        if (inactivityTimer) clearTimeout(inactivityTimer);
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      };

      const fail = (
        step: Step,
        err: unknown,
        opts?: { invalidateSession?: boolean },
      ) => {
        const { message: msg, status } = describeError(step, err);
        console.error(`[/api/chat] step=${step}`, err);
        send("error", {
          message: msg,
          // 让前端自行决定是否清掉 LocalStorage 里的 sessionId
          invalidateSession:
            opts?.invalidateSession ??
            (status === 400 || status === 404 || step === "send"),
        });
        close();
      };

      const bumpInactivity = () => {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
          send("done", { stopReason: "inactivity_timeout" });
          close();
        }, INACTIVITY_TIMEOUT_MS);
      };

      heartbeat = setInterval(heartbeatTick, HEARTBEAT_MS);
      bumpInactivity();

      let sessionId = existingSessionId;

      if (!sessionId) {
        let environmentId: string;
        try {
          environmentId = await getEnvironmentId(client);
        } catch (err) {
          return fail("environment", err);
        }

        try {
          const session = await client.beta.sessions.create({
            agent: { type: "agent", id: agentId },
            environment_id: environmentId,
          });
          sessionId = session.id;
          send("session", { sessionId });
        } catch (err) {
          return fail("session", err);
        }
      }

      // Stream-first：先开 SSE 再发消息，避免漏掉早期事件。
      let eventStream: AsyncIterable<Record<string, unknown>>;
      try {
        eventStream = (await client.beta.sessions.events.stream(
          sessionId!,
        )) as unknown as AsyncIterable<Record<string, unknown>>;
      } catch (err) {
        return fail("stream", err, { invalidateSession: true });
      }

      try {
        await client.beta.sessions.events.send(sessionId!, {
          events: [
            {
              type: "user.message",
              content: [{ type: "text", text: message }],
            },
          ],
        });
      } catch (err) {
        return fail("send", err, { invalidateSession: true });
      }

      try {
        for await (const event of eventStream) {
          if (closed) break;
          bumpInactivity();
          const type = event.type as string;

          if (type === "agent.message") {
            const content =
              (event.content as Array<Record<string, unknown>>) ?? [];
            for (const block of content) {
              if (block.type === "text" && typeof block.text === "string") {
                send("delta", { text: block.text });
              }
            }
            continue;
          }

          if (type === "session.status_terminated") {
            send("done", { stopReason: "terminated", invalidateSession: true });
            break;
          }

          if (type === "session.status_idle") {
            const stopReason = (
              event.stop_reason as { type?: string } | undefined
            )?.type;
            if (stopReason && stopReason !== "requires_action") {
              send("done", { stopReason });
              break;
            }
          }
        }
        close();
      } catch (err) {
        fail("stream", err, { invalidateSession: true });
      }
    },

    cancel() {
      // 客户端断开时清理；具体的 timer 已经在 close() 中处理。
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // 关键：阻止反向代理 / CDN 缓冲流式响应
      "X-Accel-Buffering": "no",
    },
  });
}
