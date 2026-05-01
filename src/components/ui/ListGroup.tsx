"use client";

import { ReactNode } from "react";

export function ListGroup({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      {title && (
        <div className="px-3 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
          {title}
        </div>
      )}
      <div className="overflow-hidden rounded-ios-lg bg-white shadow-card dark:bg-slate-900">
        <div className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
          {children}
        </div>
      </div>
      {footer && (
        <div className="px-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {footer}
        </div>
      )}
    </section>
  );
}

export function ListRow({
  leading,
  primary,
  secondary,
  trailing,
  onClick,
  className = "",
}: {
  leading?: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-[14px] ${
        onClick
          ? "transition-colors hover:bg-slate-100/70 active:bg-slate-200/60 dark:hover:bg-slate-800/60 dark:active:bg-slate-800"
          : ""
      } ${className}`}
    >
      {leading && <div className="flex-shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] text-slate-900 dark:text-slate-100">
          {primary}
        </div>
        {secondary && (
          <div className="mt-0.5 truncate text-[12px] text-slate-500 dark:text-slate-400">
            {secondary}
          </div>
        )}
      </div>
      {trailing && (
        <div className="flex-shrink-0 text-[13px] text-slate-500 dark:text-slate-400">
          {trailing}
        </div>
      )}
    </Tag>
  );
}
