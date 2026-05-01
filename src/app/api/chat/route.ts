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

// 紧密心跳应对企业代理 (Squid 类常见 30s idle 切断)
const HEARTBEAT_MS = 5_000;
// Anthropic 端长工具调用 (Write 大文件 / Web Search 多次) 可达 2~3 分钟
// 不出事件，留 5 分钟兜底
const INACTIVITY_TIMEOUT_MS = 300_000;

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

function readString(o: unknown, key: string): string | undefined {
  if (o && typeof o === "object" && key in o) {
    const v = (o as Record<string, unknown>)[key];
    return typeof v === "string" ? v : undefined;
  }
  return undefined;
}

// Anthropic session.error 的 error 字段嵌套不固定，做防御读取
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

// 非致命错误：agent 会自动跳过该能力继续执行
const NON_FATAL_ERRORS = new Set([
  "mcp_authentication_failed_error",
  "mcp_initialize_failed_error",
  "mcp_connection_failed_error",
]);

function friendlyErrorMessage(type: string, message: string): string {
  if (type === "mcp_authentication_failed_error") {
    return "GitHub / 第三方 MCP 未授权（已跳过；如需启用请去 Console 配置对应 Vault 凭证）";
  }
  if (type === "mcp_initialize_failed_error") {
    return "MCP Server 初始化失败（已跳过此能力）";
  }
  if (type === "model_rate_limited_error") {
    return `Anthropic API 限流：${message || "请稍后重试"}。如频繁出现，请在 Console 检查工作区配额，或换用 Sonnet/Haiku。`;
  }
  if (type === "model_overloaded_error") {
    return `Anthropic 模型当前过载：${message || "请稍后重试"}`;
  }
  if (type === "model_error") {
    return `模型执行出错：${message || "未知"}。可重试或调整 prompt。`;
  }
  return `Session 错误 (${type})${message ? `：${message}` : ""}`;
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

      const send = (event: string, data: unknown) =>
        enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      // SSE 注释行作为心跳，保持中间 proxy 不切断 idle 长连接
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

      // Stream-first：先开 SSE，再发消息，避免漏掉早期事件
      let eventStream: AsyncIterable<Record<string, unknown>>;
      try {
        eventStream = (await client.beta.sessions.events.stream(
          sessionId!,
        )) as unknown as AsyncIterable<Record<string, unknown>>;
      } catch (err) {
        return fail("stream", err, { invalidateSession: true });
      }

      // 发送 user.message 并捕获其 event id：后续靠它判断「轮到我们处理了」
      const ourEventIds = new Set<string>();
      try {
        const sendResp = (await client.beta.sessions.events.send(sessionId!, {
          events: [
            {
              type: "user.message",
              content: [{ type: "text", text: message }],
            },
          ],
        })) as { events?: Array<{ id?: string }> };
        for (const e of sendResp?.events ?? []) {
          if (e?.id) ourEventIds.add(e.id);
        }
      } catch (err) {
        return fail("send", err, { invalidateSession: true });
      }

      // 在拾取我们消息之前的事件全部跳过——可能是上一轮残留
      let ourTurnStarted = ourEventIds.size === 0; // 没拿到 id 就退化为旧行为
      let lastStatus = "";

      const sendStatus = (text: string) => {
        if (text === lastStatus) return;
        lastStatus = text;
        send("status", { text });
      };

      try {
        for await (const event of eventStream) {
          if (closed) break;
          bumpInactivity();

          const eId = readString(event, "id");
          const type = readString(event, "type") ?? "";
          const processedAt = readString(event, "processed_at");

          // 我们发的 user.message 被 agent 拾取的那一刻
          if (eId && ourEventIds.has(eId) && processedAt) {
            ourTurnStarted = true;
            sendStatus("已收到，开始处理…");
            continue;
          }
          if (!ourTurnStarted) continue;

          if (type === "agent.message") {
            const content =
              (event.content as Array<Record<string, unknown>>) ?? [];
            for (const block of content) {
              if (block.type === "text" && typeof block.text === "string") {
                lastStatus = ""; // 真正文字到了就清掉 status
                send("delta", { text: block.text });
              }
            }
            continue;
          }

          if (type === "agent.thinking") {
            sendStatus("思考中…");
            continue;
          }

          if (type === "agent.tool_use") {
            const tool = readString(event, "tool_name") ?? "工具";
            sendStatus(`调用 ${tool}…`);
            continue;
          }

          if (type === "agent.tool_result") {
            sendStatus("工具完成");
            continue;
          }

          if (type === "agent.mcp_tool_use") {
            const server = readString(event, "mcp_server_name") ?? "";
            const tool = readString(event, "tool_name") ?? "";
            sendStatus(
              `MCP${server ? ` · ${server}` : ""}${tool ? ` · ${tool}` : ""}…`,
            );
            continue;
          }

          if (type === "agent.mcp_tool_result") {
            sendStatus("MCP 完成");
            continue;
          }

          if (type === "agent.thread_context_compacted") {
            sendStatus("上下文压缩中…");
            continue;
          }

          if (type === "session.error") {
            const { type: errType, message: errMsg } =
              extractSessionError(event);
            const friendly = friendlyErrorMessage(errType, errMsg);
            console.warn(`[/api/chat] session.error type=${errType}`, errMsg);

            if (NON_FATAL_ERRORS.has(errType)) {
              // agent 会自动绕开，不打断对话流
              sendStatus(`⚠️ ${friendly}`);
              continue;
            }

            send("error", { message: friendly, invalidateSession: false });
            close();
            break;
          }

          if (type === "session.status_rescheduled") {
            sendStatus("已被自动重排队，稍候…");
            continue;
          }

          if (type === "session.status_terminated") {
            send("done", { stopReason: "terminated", invalidateSession: true });
            break;
          }

          if (type === "session.status_idle") {
            const stopReason = readString(
              event.stop_reason as Record<string, unknown> | undefined,
              "type",
            );
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
      // close() 已通过定时器钩处理；空实现保留接口
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
