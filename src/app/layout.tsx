import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "理小海 · 个人投资顾问",
  description: "管理并与理小海 Managed Agent 对话",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/60">
            <div className="mx-auto flex h-[60px] w-full max-w-6xl items-center justify-between px-4">
              <Link href="/" className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-ios-blue to-ios-indigo text-[15px] font-semibold text-white shadow-sm">
                  海
                </span>
                <div className="leading-tight">
                  <div className="text-[15px] font-semibold text-slate-900 dark:text-slate-50">
                    理小海
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    个人投资顾问 Agent
                  </div>
                </div>
              </Link>
              <nav className="flex items-center gap-1 text-[13px] font-medium">
                <Link
                  href="/"
                  className="rounded-lg px-3.5 py-1.5 text-slate-700 transition-colors hover:bg-slate-200/60 dark:text-slate-200 dark:hover:bg-slate-800/60"
                >
                  对话
                </Link>
                <Link
                  href="/manage"
                  className="rounded-lg px-3.5 py-1.5 text-slate-700 transition-colors hover:bg-slate-200/60 dark:text-slate-200 dark:hover:bg-slate-800/60"
                >
                  管理
                </Link>
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
