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

type ClientEvent =
  | { id: string; type: "delta"; text: string }
  | { id: string; type: "status"; text: string };

type SendResponse = {
  sessionId: string;
  sentEventId: string | null;
  lastEventIdBeforeSend: string | null;
  vaultIds: string[] | null;
  error?: string;
  detail?: { invalidateSession?: boolean };
};

type PollResponse = {
  events: ClientEvent[];
  lastEventId: string | null;
  isDone: boolean;
  isError: boolean;
  errorMessage?: string | null;
  error?: string;
};

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_BACKOFF_MS = 8000;

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("aborted", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("aborted", "AbortError"));
      },
      { once: true },
    );
  });
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
    setStreamStatus("正在连接…");

    const controller = new AbortController();
    abortRef.current = controller;

    const slowHint = window.setTimeout(() => {
      setStreamStatus((prev) =>
        prev === "正在连接…" ? "等待模型响应中（高峰期可能需要数秒）…" : prev,
      );
    }, 8000);

    try {
      // 1) 发送 user.message，立刻拿到 sessionId + cursor
      const sendResp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          agentId: agent.agentId,
          sessionId,
          message: trimmed,
        }),
      });
      const sendData = (await sendResp.json()) as SendResponse;

      if (!sendResp.ok) {
        if (sendData.detail?.invalidateSession) setSessionId(null);
        throw new Error(sendData.error || `请求失败：${sendResp.status}`);
      }

      setSessionId(sendData.sessionId);
      let cursor = sendData.lastEventIdBeforeSend; // null = 从头拉

      // 2) 轮询 events.list 直到 isDone / isError
      const seenIds = new Set<string>();
      let receivedAny = false;
      let backoff = POLL_INTERVAL_MS;

      while (!controller.signal.aborted) {
        const pollResp = await fetch("/api/chat/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            sessionId: sendData.sessionId,
            afterEventId: cursor,
          }),
        });
        const pollData = (await pollResp.json()) as PollResponse;

        if (!pollResp.ok) {
          // 网络/接口偶发故障：退避重试
          backoff = Math.min(backoff * 1.5, POLL_MAX_BACKOFF_MS);
          await sleep(backoff, controller.signal);
          continue;
        }
        backoff = POLL_INTERVAL_MS;

        for (const e of pollData.events) {
          if (seenIds.has(e.id)) continue;
          seenIds.add(e.id);

          if (e.type === "delta") {
            receivedAny = true;
            setStreamStatus(null);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, content: m.content + e.text }
                  : m,
              ),
            );
          } else if (e.type === "status") {
            setStreamStatus(e.text);
          }
        }

        if (pollData.lastEventId) cursor = pollData.lastEventId;

        if (pollData.isError) {
          throw new Error(pollData.errorMessage || "Session 出错");
        }
        if (pollData.isDone) {
          if (!receivedAny) {
            // agent 直接结束没产出内容（多见于 session 状态异常 / 工具配置问题）
            throw new Error(
              "Agent 直接结束未产出回复。点「新对话」重试，或检查 Console 里 Agent 配置 / MCP 凭证。",
            );
          }
          break;
        }

        await sleep(POLL_INTERVAL_MS, controller.signal);
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
      window.clearTimeout(slowHint);
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
