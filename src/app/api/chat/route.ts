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

function sseError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function describeError(step: Step, err: unknown): string {
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
    return `${stepLabel[step]}失败 (HTTP ${e.status ?? "?"}): ${apiMsg}${rid}`;
  }
  if (err instanceof Error) return `${stepLabel[step]}失败：${err.message}`;
  return `${stepLabel[step]}失败：未知错误`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return sseError(
      500,
      "缺少 ANTHROPIC_API_KEY 环境变量，请在服务器的 .env.local 中配置。",
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return sseError(400, "请求体不是合法 JSON。");
  }

  const { agentId, sessionId: existingSessionId, message } = body;
  if (!agentId || !message?.trim()) {
    return sseError(400, "缺少 agentId 或 message。");
  }

  const client = new Anthropic({ apiKey });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };
      const close = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      const fail = (step: Step, err: unknown) => {
        // 服务端日志保留完整错误，便于按 request_id 反查
        console.error(`[/api/chat] step=${step}`, err);
        send("error", { message: describeError(step, err) });
        close();
      };

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
            // 显式对象形式，比字符串简写在 SDK + API 双端都更稳。
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
        return fail("stream", err);
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
        return fail("send", err);
      }

      try {
        for await (const event of eventStream) {
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
            send("done", { stopReason: "terminated" });
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
        fail("stream", err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
