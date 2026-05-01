"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import MessageBubble from "@/components/MessageBubble";
import {
  AgentConfig,
  CHAT_STORAGE_KEY,
  DEFAULT_AGENT,
  SESSION_STORAGE_KEY,
  loadAgent,
} from "@/lib/agent";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function ChatPage() {
  const [agent, setAgent] = useState<AgentConfig>(DEFAULT_AGENT);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAgent(loadAgent());
    try {
      const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed)) setMessages(parsed);
      }
      const sid = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (sid) setSessionId(sid);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionId) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const visibleMessages = useMemo(() => {
    if (messages.length > 0) return messages;
    return [
      {
        id: "greeting",
        role: "assistant" as const,
        content: agent.greeting,
      },
    ];
  }, [messages, agent.greeting]);

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    if (!agent.agentId) {
      setError("请先在管理页配置 Agent ID。");
      return;
    }

    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: trimmed,
    };
    const assistantMsg: ChatMessage = {
      id: uid(),
      role: "assistant",
      content: "",
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setSending(true);
    setError(null);
    setStreamStatus(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          agentId: agent.agentId,
          sessionId,
          message: trimmed,
        }),
      });

      if (!res.ok || !res.body) {
        const text = await res.text();
        throw new Error(text || `请求失败：${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let invalidate = false;
      let receivedAny = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const event = parseEvent(chunk);
          if (!event) continue;

          if (event.type === "session") {
            setSessionId(event.data.sessionId);
          } else if (event.type === "status") {
            setStreamStatus(event.data.text || null);
          } else if (event.type === "delta") {
            // 极小概率上游 proxy 漏 HTML 错误页进 SSE 流；检测到就当作传输错误。
            if (looksLikeHtml(event.data.text)) {
              throw new Error(
                "网络代理切断了 SSE 长连接（返回了 HTML 错误页），请稍后重试。",
              );
            }
            receivedAny = true;
            setStreamStatus(null); // 真正文字到达，清掉进度行
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, content: m.content + event.data.text }
                  : m,
              ),
            );
          } else if (event.type === "done") {
            if (event.data.invalidateSession) invalidate = true;
            if (event.data.stopReason === "inactivity_timeout" && !receivedAny) {
              throw new Error(
                "Agent 在 90 秒内没有产出任何回复，已自动结束。常见原因：Session 状态异常（点「新对话」重试）或 Agent 工具未配置。",
              );
            }
          } else if (event.type === "error") {
            if (event.data.invalidateSession) invalidate = true;
            throw new Error(event.data.message || "对话出错");
          }
        }
      }

      if (invalidate) setSessionId(null);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const errMessage = err instanceof Error ? err.message : "对话失败";
      setError(errMessage);
      // 任何错误都假定 session 已不可用，下条消息会自动新建。
      setSessionId(null);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id && m.content === ""
            ? { ...m, content: `⚠️ ${errMessage}` }
            : m,
        ),
      );
    } finally {
      setSending(false);
      setStreamStatus(null);
      abortRef.current = null;
    }
  }, [agent, input, sending, sessionId]);

  const stop = () => {
    abortRef.current?.abort();
    setSending(false);
  };

  const newConversation = () => {
    setMessages([]);
    setSessionId(null);
    setError(null);
    setStreamStatus(null);
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-60px-2rem)] w-full max-w-5xl flex-col gap-4 px-4 py-4">
      <section className="flex items-center justify-between rounded-ios-lg bg-white p-4 shadow-card dark:bg-slate-900">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">{agent.name}</h1>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">
            {agent.description}
          </p>
          <p className="mt-1 truncate text-xs text-slate-400">
            <span className="font-mono">{agent.agentId}</span>
            {sessionId && (
              <>
                {" · "}
                <span className="font-mono">{sessionId}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={newConversation}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            新对话
          </button>
          <Link
            href="/manage"
            className="rounded-lg bg-ios-blue px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-ios-blueHover"
          >
            管理
          </Link>
        </div>
      </section>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-ios-lg bg-white p-4 shadow-card dark:bg-slate-900"
      >
        {visibleMessages.map((m, i) => (
          <MessageBubble
            key={m.id}
            role={m.role}
            content={m.content}
            agentName={agent.name}
            streaming={
              sending &&
              m.role === "assistant" &&
              i === visibleMessages.length - 1
            }
          />
        ))}
        {sending && streamStatus && (
          <div className="flex items-center gap-2 pl-11 text-[12px] text-slate-500 dark:text-slate-400">
            <span className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-ios-blue" />
            <span>{streamStatus}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      <form
        className="flex gap-2 rounded-ios-lg bg-white p-2 shadow-card dark:bg-slate-900"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder={`和 ${agent.name} 聊聊吧… (Enter 发送，Shift+Enter 换行)`}
          className="flex-1 resize-none bg-transparent px-3 py-2 text-[14px] outline-none placeholder:text-slate-400"
          disabled={sending}
        />
        {sending ? (
          <button
            type="button"
            onClick={stop}
            className="rounded-lg bg-slate-700 px-4 text-[13px] font-medium text-white transition-colors hover:bg-slate-800"
          >
            停止
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-lg bg-ios-blue px-4 text-[13px] font-medium text-white transition-colors hover:bg-ios-blueHover disabled:cursor-not-allowed disabled:opacity-50"
          >
            发送
          </button>
        )}
      </form>
    </div>
  );
}

type ParsedEvent =
  | { type: "session"; data: { sessionId: string } }
  | { type: "status"; data: { text: string } }
  | { type: "delta"; data: { text: string } }
  | {
      type: "done";
      data: { stopReason?: string; invalidateSession?: boolean };
    }
  | {
      type: "error";
      data: { message: string; invalidateSession?: boolean };
    };

function looksLikeHtml(text: string): boolean {
  const t = text.trimStart().toLowerCase();
  return (
    t.startsWith("<html") ||
    t.startsWith("<!doctype") ||
    t.startsWith("<head>") ||
    t.startsWith("<body")
  );
}

function parseEvent(chunk: string): ParsedEvent | null {
  const lines = chunk.split("\n");
  let event = "";
  let data = "";
  for (const line of lines) {
    if (line.startsWith(":")) continue; // 心跳注释
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!event) return null;
  try {
    const parsed = JSON.parse(data);
    if (event === "session") return { type: "session", data: parsed };
    if (event === "status") return { type: "status", data: parsed };
    if (event === "delta") return { type: "delta", data: parsed };
    if (event === "done") return { type: "done", data: parsed };
    if (event === "error") return { type: "error", data: parsed };
  } catch {
    return null;
  }
  return null;
}
