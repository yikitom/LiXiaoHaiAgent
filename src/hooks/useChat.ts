"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChatApiError,
  pollEventsReq,
  sendMessageReq,
} from "@/lib/chat-api";
import type { ChatMessage } from "@/lib/chat-types";

const STORAGE_MESSAGES = "lixiaohai-chat-msgs-v3";
const STORAGE_SESSION = "lixiaohai-chat-session-v2";
const POLL_INTERVAL_MS = 1500;
const POLL_MAX_BACKOFF_MS = 8000;
const SLOW_HINT_MS = 8000;

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted)
      return reject(new DOMException("aborted", "AbortError"));
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

/**
 * useChat —— 与理小海对话的状态机。
 *
 * 设计原则：
 * 1. messages 不可变追加：每个 agent.message 事件创建独立 bubble；不再
 *    把多个 delta 累加到同一气泡里（上一个版本的核心 bug 来源）。
 * 2. 严格 dedup：seenEventIds 跨整个会话生命周期保持，确保即便 cursor
 *    出现回滚 / 跨 turn 重复拉取也不重复渲染。
 * 3. 关注点分离：UI 层只读 hook 暴露的 state；网络细节、错误恢复、持久
 *    化都封在 hook 内部。
 */
export function useChat(agentId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // 保存所有已渲染过的 Anthropic 事件 id；跨多次 send 持续累积
  const seenEventIdsRef = useRef<Set<string>>(new Set());

  // 初次 mount 从 localStorage 恢复
  useEffect(() => {
    try {
      const m = window.localStorage.getItem(STORAGE_MESSAGES);
      if (m) {
        const parsed = JSON.parse(m);
        if (Array.isArray(parsed)) {
          setMessages(parsed as ChatMessage[]);
          // 把已加载消息的 eventId 也填进 seen 集合
          for (const msg of parsed as ChatMessage[]) {
            if (msg.eventId) seenEventIdsRef.current.add(msg.eventId);
          }
        }
      }
      const sid = window.localStorage.getItem(STORAGE_SESSION);
      if (sid) setSessionId(sid);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_MESSAGES, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionId) window.localStorage.setItem(STORAGE_SESSION, sessionId);
    else window.localStorage.removeItem(STORAGE_SESSION);
  }, [sessionId]);

  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;
      if (!agentId) {
        setError("请先在管理页配置 Agent ID。");
        return;
      }

      // 1) 立即追加 user 气泡（乐观更新）
      appendMessage({
        id: uid(),
        role: "user",
        content: trimmed,
        createdAt: nowIso(),
      });

      setIsLoading(true);
      setError(null);
      setStatus("正在连接…");

      const controller = new AbortController();
      abortRef.current = controller;

      const slowHint = window.setTimeout(() => {
        setStatus((s) =>
          s === "正在连接…" ? "等待模型响应中（高峰期可能数秒）…" : s,
        );
      }, SLOW_HINT_MS);

      try {
        // 2) 发送（坏 session 自动重建一次）
        const trySend = (sid: string | null) =>
          sendMessageReq(
            { agentId, sessionId: sid, message: trimmed },
            controller.signal,
          );

        let sendData;
        try {
          sendData = await trySend(sessionId);
        } catch (err) {
          if (
            err instanceof ChatApiError &&
            err.invalidateSession &&
            sessionId
          ) {
            setStatus("会话已失效，自动重建中…");
            setSessionId(null);
            sendData = await trySend(null);
          } else {
            throw err;
          }
        }

        setSessionId(sendData.sessionId);
        let cursor: string | null = sendData.cursorCreatedAt;

        // 3) 轮询，直到 isDone / isError / abort
        let backoff = POLL_INTERVAL_MS;

        while (!controller.signal.aborted) {
          let pollData;
          try {
            pollData = await pollEventsReq(
              {
                sessionId: sendData.sessionId,
                afterCreatedAt: cursor,
              },
              controller.signal,
            );
          } catch (err) {
            // 传输级故障：指数退避重试
            if ((err as Error).name === "AbortError") throw err;
            backoff = Math.min(backoff * 1.5, POLL_MAX_BACKOFF_MS);
            await sleep(backoff, controller.signal);
            continue;
          }
          backoff = POLL_INTERVAL_MS;

          for (const ev of pollData.events) {
            if (seenEventIdsRef.current.has(ev.id)) continue;
            seenEventIdsRef.current.add(ev.id);

            if (ev.type === "delta") {
              // 每个 agent.message 事件创建一个独立、不可变 bubble；
              // 大消息额外携带 fullContent，给气泡渲染"查看完整内容"
              appendMessage({
                id: uid(),
                eventId: ev.id,
                role: "assistant",
                content: ev.text,
                fullContent: ev.fullText,
                isLarge: ev.isLarge,
                createdAt: nowIso(),
              });
              setStatus(null);
            } else if (ev.type === "status") {
              setStatus(ev.text);
            }
          }

          if (pollData.lastCreatedAt) cursor = pollData.lastCreatedAt;

          if (pollData.isError) {
            if (pollData.invalidateSession) setSessionId(null);
            throw new Error(pollData.errorMessage || "Session 出错");
          }
          if (pollData.isDone) break;

          await sleep(POLL_INTERVAL_MS, controller.signal);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const errMsg = err instanceof Error ? err.message : "对话失败";
        setError(errMsg);
        appendMessage({
          id: uid(),
          role: "assistant",
          content: `⚠️ ${errMsg}`,
          createdAt: nowIso(),
        });
      } finally {
        window.clearTimeout(slowHint);
        setIsLoading(false);
        setStatus(null);
        abortRef.current = null;
      }
    },
    [agentId, sessionId, isLoading, appendMessage],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
    setStatus(null);
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setSessionId(null);
    setError(null);
    setStatus(null);
    setIsLoading(false);
    seenEventIdsRef.current = new Set();
  }, []);

  return {
    messages,
    sessionId,
    isLoading,
    status,
    error,
    send,
    stop,
    reset,
  };
}
