"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AVAILABLE_MODELS,
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
            在这里调整李小海的人设、模型与对话参数。配置保存在浏览器中。
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

      <section className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            身份
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
        </div>

        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            模型与生成参数
          </h2>
          <Field label="模型">
            <select
              className={inputClass}
              value={cfg.model}
              onChange={(e) => update("model", e.target.value)}
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {m.note ? ` · ${m.note}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={`温度 (temperature) — ${cfg.temperature.toFixed(2)}`}
            hint="0 更稳定，1 更发散"
          >
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={cfg.temperature}
              onChange={(e) => update("temperature", Number(e.target.value))}
              className="w-full accent-ocean-600"
            />
          </Field>
          <Field label="最大输出 tokens (max_tokens)">
            <input
              type="number"
              min={64}
              max={8192}
              step={64}
              className={inputClass}
              value={cfg.maxTokens}
              onChange={(e) =>
                update("maxTokens", Math.max(64, Number(e.target.value) || 0))
              }
            />
          </Field>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            系统提示词 (System Prompt)
          </h2>
          <span className="text-xs text-slate-400">
            {cfg.systemPrompt.length} 字符
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          这段提示词会作为 system 字段传给 Claude，决定李小海的人格与行为约束。
        </p>
        <textarea
          className={`${inputClass} min-h-[260px] font-mono text-[13px] leading-6`}
          value={cfg.systemPrompt}
          onChange={(e) => update("systemPrompt", e.target.value)}
        />
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
      {hint && (
        <span className="block text-xs text-slate-400">{hint}</span>
      )}
    </label>
  );
}
