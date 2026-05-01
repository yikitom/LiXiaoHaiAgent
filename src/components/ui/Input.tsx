"use client";

import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";

const BASE =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 shadow-sm outline-none transition-colors focus:border-ios-blue focus:ring-2 focus:ring-ios-blue/20 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className = "", ...rest }, ref) {
  return <input ref={ref} {...rest} className={`${BASE} ${className}`} />;
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = "", ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      {...rest}
      className={`${BASE} resize-y leading-relaxed ${className}`}
    />
  );
});

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-medium text-slate-600 dark:text-slate-300">
        {label}
      </span>
      {children}
      {hint && (
        <span className="block text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          {hint}
        </span>
      )}
    </label>
  );
}
