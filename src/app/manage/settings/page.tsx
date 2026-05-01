"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { Card, CardHeader, PageHeader } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { AgentConfig, DEFAULT_AGENT, loadAgent, saveAgent } from "@/lib/agent";

export default function SettingsPage() {
  const [cfg, setCfg] = useState<AgentConfig>(DEFAULT_AGENT);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCfg(loadAgent());
  }, []);

  const set = <K extends keyof AgentConfig>(k: K, v: AgentConfig[K]) =>
    setCfg((prev) => ({ ...prev, [k]: v }));

  return (
    <div>
      <PageHeader
        title="基础设置"
        description="Managed Agent 的连接信息与对话页显示文案。模型 / System Prompt / Skills / MCP 工具均在 Anthropic Console 中维护。"
        trailing={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (confirm("恢复默认设置？")) {
                  setCfg(DEFAULT_AGENT);
                  saveAgent(DEFAULT_AGENT);
                }
              }}
            >
              恢复默认
            </Button>
            <Button
              onClick={() => {
                saveAgent(cfg);
                setSaved(true);
                window.setTimeout(() => setSaved(false), 1500);
              }}
            >
              保存
            </Button>
          </div>
        }
      />

      {saved && (
        <div className="mb-3 rounded-lg bg-ios-green/10 px-3 py-2 text-[13px] text-ios-green">
          已保存。返回对话页生效。
        </div>
      )}

      <Card>
        <CardHeader
          title="Managed Agent"
          description="Anthropic Console 中创建的 Agent；每次对话会用此 ID 创建 Session。"
        />
        <Field
          label="Agent ID"
          hint="agent_ 开头。改动后下一条消息会创建新 Session（即重新初始化对话上下文）。"
        >
          <Input
            className="font-mono"
            value={cfg.agentId}
            onChange={(e) => set("agentId", e.target.value.trim())}
            placeholder="agent_011CabNgA9MEKd3p63BmR566"
          />
        </Field>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="对话页显示"
          description="只影响本前端展示，不会写入 Anthropic 端的 Agent 配置。"
        />
        <div className="space-y-4">
          <Field label="名称">
            <Input
              value={cfg.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label="一句话描述">
            <Input
              value={cfg.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
          <Field label="开场白">
            <Textarea
              rows={3}
              value={cfg.greeting}
              onChange={(e) => set("greeting", e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="服务端环境变量提示"
          description="部署时建议显式设置以下变量，避免重启后丢失状态。"
        />
        <dl className="space-y-3 text-[13px]">
          <EnvRow
            name="ANTHROPIC_API_KEY"
            required
            desc="必填。仅服务端读取，前端不接触。"
          />
          <EnvRow
            name="ANTHROPIC_ENVIRONMENT_ID"
            desc="可选。固定 Cloud Environment，避免每次冷启动新建。"
          />
        </dl>
      </Card>
    </div>
  );
}

function EnvRow({
  name,
  desc,
  required,
}: {
  name: string;
  desc: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-200/60 pb-3 last:border-b-0 last:pb-0 dark:border-slate-800/60">
      <div>
        <code className="font-mono text-[13px] font-semibold">{name}</code>
        <div className="mt-0.5 text-[12px] leading-relaxed text-slate-500">
          {desc}
        </div>
      </div>
      {required ? (
        <span className="rounded-full bg-ios-red/15 px-2 py-0.5 text-[11px] font-medium text-ios-red">
          必填
        </span>
      ) : (
        <span className="rounded-full bg-slate-200/60 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
          可选
        </span>
      )}
    </div>
  );
}
