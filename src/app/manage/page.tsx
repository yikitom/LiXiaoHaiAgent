"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AgentConfig,
  DEFAULT_AGENT,
  loadAgent,
  saveAgent,
} from "@/lib/agent";

export default function ManagePage() {
  const [cfg, setCfg] = useState<AgentConfig>(DEFAULT_AGENT);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCfg(loadAgent());
  }, []);

  const update = <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) =>
    setCfg((prev) => ({ ...prev, [key]: value }));

  const onSave = () => {
    saveAgent(cfg);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const onReset = () => {
    if (confirm("恢复默认配置？已保存的内容将被覆盖。")) {
      setCfg(DEFAULT_AGENT);
      saveAgent(DEFAULT_AGENT);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Agent 管理</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            理小海是在 Anthropic Console 中定义的 Managed Agent，模型 / System
            Prompt / 工具都在 Console 中维护。这里只配置前端显示信息和对应的 Agent
            ID。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            返回对话
          </Link>
          <button
            type="button"
            onClick={onReset}
            className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950"
          >
            恢复默认
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-md bg-ocean-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-ocean-700"
          >
            保存配置
          </button>
        </div>
      </header>

      {saved && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          已保存。返回对话页即可生效。
        </div>
      )}

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Managed Agent
        </h2>
        <Field
          label="Agent ID"
          hint="Anthropic Console 中创建的 Managed Agent ID（agent_ 开头）。每次对话会用这个 ID 创建 Session。"
        >
          <input
            className={`${inputClass} font-mono`}
            value={cfg.agentId}
            placeholder="agent_011CabNgA9MEKd3p63BmR566"
            onChange={(e) => update("agentId", e.target.value.trim())}
          />
        </Field>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          显示信息
        </h2>
        <Field label="名称">
          <input
            className={inputClass}
            value={cfg.name}
            onChange={(e) => update("name", e.target.value)}
          />
        </Field>
        <Field label="一句话描述">
          <input
            className={inputClass}
            value={cfg.description}
            onChange={(e) => update("description", e.target.value)}
          />
        </Field>
        <Field label="开场白">
          <textarea
            className={`${inputClass} h-24 resize-none`}
            value={cfg.greeting}
            onChange={(e) => update("greeting", e.target.value)}
          />
        </Field>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
        <div className="mb-1 font-semibold text-slate-700 dark:text-slate-200">
          说明
        </div>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            Managed Agent 的模型、System Prompt、Skills、MCP 工具等都在 Anthropic
            Console 中配置；前端不再需要调这些参数。
          </li>
          <li>
            服务端首次对话时会自动创建一个 Cloud Environment，并缓存在内存中；
            生产环境建议在 <code className="font-mono">.env.local</code> 中显式
            设置 <code className="font-mono">ANTHROPIC_ENVIRONMENT_ID</code>。
          </li>
          <li>
            对话页的「新对话」按钮会清空当前 Session ID 与本地消息，下一条消息会创建新
            Session。
          </li>
        </ul>
      </section>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

function Field({
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
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
        {label}
      </span>
      {children}
      {hint && <span className="block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}
