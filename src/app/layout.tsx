import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "李小海 Agent 控制台",
  description: "管理并与李小海 Agent 对话",
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
          <header className="border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
              <Link href="/" className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ocean-600 text-base font-semibold text-white">
                  海
                </span>
                <div className="leading-tight">
                  <div className="text-sm font-semibold">李小海 Agent</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Powered by Claude
                  </div>
                </div>
              </Link>
              <nav className="flex items-center gap-1 text-sm">
                <Link
                  href="/"
                  className="rounded-md px-3 py-1.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  对话
                </Link>
                <Link
                  href="/manage"
                  className="rounded-md px-3 py-1.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  管理
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
            {children}
          </main>
          <footer className="border-t border-slate-200/70 py-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            李小海 Agent · 与 Claude 对话
          </footer>
        </div>
      </body>
    </html>
  );
}
