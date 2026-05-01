"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import MessageBubble from "@/components/MessageBubble";
import { AgentConfig, DEFAULT_AGENT, loadAgent } from "@/lib/agent";
import { useChat } from "@/hooks/useChat";

export default function ChatPage() {
  const [agent, setAgent] = useState<AgentConfig>(DEFAULT_AGENT);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAgent(loadAgent());
  }, []);

  const {
    messages,
    sessionId,
    isLoading,
    status,
    error,
    send,
    stop,
    reset,
  } = useChat(agent.agentId);

  // 自动滚到底
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status]);

  const visibleMessages = useMemo(() => {
    if (messages.length > 0) return messages;
    return [
      {
        id: "greeting",
        role: "assistant" as const,
        content: agent.greeting,
        createdAt: new Date().toISOString(),
      },
    ];
  }, [messages, agent.greeting]);

  // 流式动画：仅当当前在加载、且最后一条不是 assistant（即 agent 还没出第一条 message 时），
  // 把 typing 三点加在尾巴上。assistant 出现后用 status 行做进度提示。
  const showTypingTail =
    isLoading && messages[messages.length - 1]?.role !== "assistant";

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input;
    setInput("");
    send(text);
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
            onClick={reset}
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
        {visibleMessages.map((m) => (
          <MessageBubble
            key={m.id}
            role={m.role === "system" ? "assistant" : m.role}
            content={m.content}
            agentName={agent.name}
            streaming={false}
            fullContent={"fullContent" in m ? m.fullContent : undefined}
          />
        ))}

        {showTypingTail && (
          <MessageBubble
            role="assistant"
            content=""
            agentName={agent.name}
            streaming={true}
          />
        )}

        {isLoading && status && (
          <div className="flex items-center gap-2 pl-11 text-[12px] text-slate-500 dark:text-slate-400">
            <span className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-ios-blue" />
            <span>{status}</span>
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
        onSubmit={onSubmit}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (input.trim() && !isLoading) {
                const text = input;
                setInput("");
                send(text);
              }
            }
          }}
          rows={2}
          placeholder={`和 ${agent.name} 聊聊吧… (Enter 发送，Shift+Enter 换行)`}
          className="flex-1 resize-none bg-transparent px-3 py-2 text-[14px] outline-none placeholder:text-slate-400"
          disabled={isLoading}
        />
        {isLoading ? (
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
