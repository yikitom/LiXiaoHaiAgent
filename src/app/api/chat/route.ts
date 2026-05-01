import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatRequestBody = {
  agentId: string;
  sessionId?: string;
  message: string;
};

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

      try {
        let sessionId = existingSessionId;

        if (!sessionId) {
          const environmentId = await getEnvironmentId(client);
          const session = await client.beta.sessions.create({
            agent: agentId,
            environment_id: environmentId,
          });
          sessionId = session.id;
          send("session", { sessionId });
        }

        // Stream-first: open the SSE stream BEFORE sending the message,
        // otherwise early events (status transitions, first agent.message)
        // can land before our consumer is attached.
        const eventStream = await client.beta.sessions.events.stream(sessionId);

        await client.beta.sessions.events.send(sessionId, {
          events: [
            {
              type: "user.message",
              content: [{ type: "text", text: message }],
            },
          ],
        });

        for await (const event of eventStream as AsyncIterable<
          Record<string, unknown>
        >) {
          const type = event.type as string;

          if (type === "agent.message") {
            const content = (event.content as Array<Record<string, unknown>>) ?? [];
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
            const stopReason = (event.stop_reason as { type?: string } | undefined)
              ?.type;
            if (stopReason && stopReason !== "requires_action") {
              send("done", { stopReason });
              break;
            }
          }
        }

        close();
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : "调用 Anthropic API 失败。";
        send("error", { message: errMsg });
        close();
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
