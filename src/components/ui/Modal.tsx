"use client";

import { ReactNode, useEffect } from "react";

export default function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const widths: Record<string, string> = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${widths[size]} overflow-hidden rounded-ios-lg bg-white shadow-modal dark:bg-slate-900`}
      >
        {(title || description) && (
          <div className="border-b border-slate-200/60 px-6 py-4 dark:border-slate-800/60">
            {title && (
              <h3 className="text-[17px] font-semibold text-slate-900 dark:text-slate-100">
                {title}
              </h3>
            )}
            {description && (
              <p className="mt-1 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
        )}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 text-[14px] leading-relaxed text-slate-700 dark:text-slate-200">
          {children}
        </div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-200/60 bg-slate-50 px-6 py-3 dark:border-slate-800/60 dark:bg-slate-900/80">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
