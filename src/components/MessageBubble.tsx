"use client";

import { memo, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

type Props = {
  role: "user" | "assistant";
  content: string;
  agentName: string;
  streaming?: boolean;
  /** 大消息原文：存在时气泡里只显 preview，附"查看完整内容"按钮 */
  fullContent?: string;
};

function renderContent(content: string) {
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

function formatBytes(text: string): string {
  const bytes = new Blob([text]).size;
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function MessageBubble({
  role,
  content,
  agentName,
  streaming,
  fullContent,
}: Props) {
  const isUser = role === "user";
  const parts = renderContent(content);
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
        <div
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
            isUser
              ? "bg-slate-500"
              : "bg-gradient-to-br from-ios-blue to-ios-indigo"
          }`}
          aria-hidden
        >
          {isUser ? "我" : "海"}
        </div>
        <div
          className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-[14px] leading-6 ${
            isUser
              ? "rounded-br-sm bg-ios-blue text-white"
              : "rounded-bl-sm bg-white text-slate-800 shadow-card dark:bg-slate-900 dark:text-slate-100"
          }`}
        >
          {!isUser && (
            <div className="mb-1 text-[11px] font-medium text-ios-blue">
              {agentName}
            </div>
          )}
          <div className="prose-chat whitespace-pre-wrap break-words">
            {streaming && content === "" ? (
              <TypingDots />
            ) : (
              <>
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
              </>
            )}
          </div>

          {fullContent && !isUser && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-3 flex w-full items-center justify-between gap-3 rounded-lg border border-ios-blue/20 bg-ios-blue/5 px-3 py-2 text-[12px] font-medium text-ios-blue transition-colors hover:bg-ios-blue/10"
            >
              <span className="flex items-center gap-2">
                <span aria-hidden>📋</span>
                <span>查看完整内容</span>
              </span>
              <span className="text-[11px] text-ios-blue/70">
                {fullContent.length.toLocaleString()} 字 · {formatBytes(fullContent)}
              </span>
            </button>
          )}
        </div>
      </div>

      {fullContent && (
        <Modal
          open={expanded}
          onClose={() => setExpanded(false)}
          title={`${agentName} · 完整内容`}
          description={`${fullContent.length.toLocaleString()} 字 · ${formatBytes(fullContent)}`}
          size="lg"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  navigator.clipboard?.writeText(fullContent);
                }}
              >
                复制全文
              </Button>
              <Button onClick={() => setExpanded(false)}>关闭</Button>
            </>
          }
        >
          <div className="prose-chat whitespace-pre-wrap break-words text-[13px] leading-7">
            {renderContent(fullContent).map((p, i) =>
              p.type === "code" ? (
                <pre key={i}>
                  <code className={`language-${p.lang}`}>{p.value}</code>
                </pre>
              ) : (
                <span key={i}>{p.value}</span>
              ),
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

function TypingDots() {
  return (
    <span
      role="status"
      aria-label="正在思考"
      className="inline-flex items-center gap-1 py-1"
    >
      <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
      <span className="typing-dot typing-dot--2 inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
      <span className="typing-dot typing-dot--3 inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
    </span>
  );
}

export default memo(MessageBubble);
