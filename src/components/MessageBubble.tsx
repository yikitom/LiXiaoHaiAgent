"use client";

import { memo } from "react";

type Props = {
  role: "user" | "assistant";
  content: string;
  agentName: string;
  streaming?: boolean;
};

function renderContent(content: string) {
  // Minimal renderer: split fenced code blocks from paragraphs.
  const parts: { type: "code" | "text"; lang?: string; value: string }[] = [];
  const regex = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: "code", lang: match[1] || "text", value: match[2] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < content.length) {
    parts.push({ type: "text", value: content.slice(lastIndex) });
  }
  return parts;
}

function MessageBubble({ role, content, agentName, streaming }: Props) {
  const isUser = role === "user";
  const parts = renderContent(content);

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
          isUser ? "bg-slate-500" : "bg-ocean-600"
        }`}
        aria-hidden
      >
        {isUser ? "我" : "海"}
      </div>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-6 shadow-sm ${
          isUser
            ? "rounded-br-sm bg-ocean-600 text-white"
            : "rounded-bl-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
        }`}
      >
        {!isUser && (
          <div className="mb-1 text-xs font-medium text-ocean-700 dark:text-ocean-300">
            {agentName}
          </div>
        )}
        <div className="prose-chat whitespace-pre-wrap break-words">
          {parts.map((p, i) =>
            p.type === "code" ? (
              <pre key={i}>
                <code className={`language-${p.lang}`}>{p.value}</code>
              </pre>
            ) : (
              <span key={i}>{p.value}</span>
            ),
          )}
          {streaming && (
            <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-current" />
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(MessageBubble);
