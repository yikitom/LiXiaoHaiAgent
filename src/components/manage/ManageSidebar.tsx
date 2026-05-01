"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/manage", label: "概览", glyph: "◐" },
  { href: "/manage/profile", label: "个人画像", glyph: "◉" },
  { href: "/manage/skills", label: "Skills", glyph: "◆" },
  { href: "/manage/watchlist", label: "自选标的", glyph: "★" },
  { href: "/manage/memory", label: "记忆", glyph: "◫" },
  { href: "/manage/reports", label: "报告", glyph: "▤" },
  { href: "/manage/risk", label: "风控", glyph: "◈" },
  { href: "/manage/settings", label: "基础设置", glyph: "⚙︎" },
] as const;

export default function ManageSidebar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-[60px] hidden h-[calc(100vh-60px)] w-60 flex-shrink-0 flex-col gap-1 overflow-y-auto px-3 py-6 md:flex">
      <div className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Agent 控制台
      </div>
      {SECTIONS.map((s) => {
        const active =
          s.href === "/manage"
            ? pathname === "/manage"
            : pathname?.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-colors ${
              active
                ? "bg-ios-blue text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-200/60 dark:text-slate-200 dark:hover:bg-slate-800/60"
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center text-[13px] ${
                active
                  ? "text-white"
                  : "text-ios-blue group-hover:text-ios-blue"
              }`}
              aria-hidden
            >
              {s.glyph}
            </span>
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ManageSegmentedNav() {
  const pathname = usePathname();
  return (
    <div className="-mx-4 mb-4 overflow-x-auto px-4 md:hidden">
      <div className="flex gap-1.5">
        {SECTIONS.map((s) => {
          const active =
            s.href === "/manage"
              ? pathname === "/manage"
              : pathname?.startsWith(s.href);
          return (
            <Link
              key={s.href}
              href={s.href}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                active
                  ? "bg-ios-blue text-white"
                  : "bg-white text-slate-700 shadow-card dark:bg-slate-900 dark:text-slate-200"
              }`}
            >
              {s.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
