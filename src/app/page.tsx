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
          } else if (event.type === "delta") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, content: m.content + event.data.text }
                  : m,
              ),
            );
          } else if (event.type === "error") {
            throw new Error(event.data.message || "对话出错");
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const errMessage = err instanceof Error ? err.message : "对话失败";
      setError(errMessage);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id && m.content === ""
            ? { ...m, content: `⚠️ ${errMessage}` }
            : m,
        ),
      );
    } finally {
      setSending(false);
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
  };

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col gap-4">
      <section className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            新对话
          </button>
          <Link
            href="/manage"
            className="rounded-md bg-ocean-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-ocean-700"
          >
            配置
          </Link>
        </div>
      </section>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
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
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      <form
        className="flex gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900"
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
          className="flex-1 resize-none rounded-md border border-transparent bg-transparent px-3 py-2 text-sm outline-none focus:border-ocean-400"
          disabled={sending}
        />
        {sending ? (
          <button
            type="button"
            onClick={stop}
            className="rounded-md bg-slate-700 px-4 text-sm font-medium text-white hover:bg-slate-800"
          >
            停止
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-md bg-ocean-600 px-4 text-sm font-medium text-white hover:bg-ocean-700 disabled:cursor-not-allowed disabled:opacity-50"
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
  | { type: "delta"; data: { text: string } }
  | { type: "done"; data: { stopReason?: string } }
  | { type: "error"; data: { message: string } };

function parseEvent(chunk: string): ParsedEvent | null {
  const lines = chunk.split("\n");
  let event = "";
  let data = "";
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!event) return null;
  try {
    const parsed = JSON.parse(data);
    if (event === "session") return { type: "session", data: parsed };
    if (event === "delta") return { type: "delta", data: parsed };
    if (event === "done") return { type: "done", data: parsed };
    if (event === "error") return { type: "error", data: parsed };
  } catch {
    return null;
  }
  return null;
}
