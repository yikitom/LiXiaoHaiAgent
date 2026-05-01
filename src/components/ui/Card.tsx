"use client";

import { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-ios-lg bg-white p-5 shadow-card dark:bg-slate-900 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  trailing,
}: {
  title: ReactNode;
  description?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold leading-tight text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
      {trailing && <div className="flex-shrink-0">{trailing}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  trailing,
}: {
  title: ReactNode;
  description?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[28px] font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-[14px] leading-relaxed text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
      {trailing && <div className="flex-shrink-0">{trailing}</div>}
    </header>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "blue" | "green" | "orange" | "red" | "indigo";
}) {
  const tones: Record<string, string> = {
    neutral:
      "bg-slate-200/70 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200",
    blue: "bg-ios-blue/15 text-ios-blue",
    green: "bg-ios-green/15 text-ios-green",
    orange: "bg-ios-orange/15 text-ios-orange",
    red: "bg-ios-red/15 text-ios-red",
    indigo: "bg-ios-indigo/15 text-ios-indigo",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-ios-lg bg-white p-4 shadow-card dark:bg-slate-900">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-[24px] font-semibold leading-tight text-slate-900 dark:text-slate-50">
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
          {hint}
        </div>
      )}
    </div>
  );
}
