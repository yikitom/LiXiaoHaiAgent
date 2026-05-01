import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequestBody = {
  messages: ChatMessage[];
  system: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          "缺少 ANTHROPIC_API_KEY 环境变量，请在服务器的 .env.local 中配置。",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "请求体不是合法 JSON。" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages, system, model, temperature, maxTokens } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages 不能为空。" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const client = new Anthropic({ apiKey });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        const response = client.messages.stream({
          model: model || "claude-opus-4-7",
          max_tokens: Math.max(64, Math.min(maxTokens ?? 2048, 8192)),
          temperature:
            typeof temperature === "number"
              ? Math.max(0, Math.min(temperature, 1))
              : 0.7,
          system: system || undefined,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        });

        response.on("text", (delta) => {
          send("delta", { text: delta });
        });

        const final = await response.finalMessage();
        send("done", {
          usage: final.usage,
          stopReason: final.stop_reason,
        });
        controller.close();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "调用 Anthropic API 失败。";
        send("error", { message });
        controller.close();
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
