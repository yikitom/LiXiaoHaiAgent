"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardHeader, PageHeader, Pill, Stat } from "@/components/ui/Card";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { loadAgent } from "@/lib/agent";
import { loadSkills } from "@/lib/skills";
import { loadWatchlist } from "@/lib/watchlist";
import { loadMemory } from "@/lib/memory";
import { loadReports } from "@/lib/reports";
import { loadProfile } from "@/lib/profile";

export default function OverviewPage() {
  const [data, setData] = useState({
    agentName: "理小海",
    agentId: "",
    skills: 0,
    pendingIter: 0,
    watch: 0,
    memory: 0,
    profileName: "",
    reports: [] as { id: string; title: string; generatedAt: string }[],
    pendingSkills: [] as { id: string; name: string }[],
  });

  useEffect(() => {
    const agent = loadAgent();
    const skills = loadSkills();
    const watch = loadWatchlist();
    const memory = loadMemory();
    const reports = loadReports();
    const profile = loadProfile();
    setData({
      agentName: agent.name,
      agentId: agent.agentId,
      skills: skills.filter((s) => s.installed).length,
      pendingIter: skills.filter((s) => s.pendingIteration).length,
      watch: watch.length,
      memory: memory.length,
      profileName: profile.fullName || "尚未填写姓名",
      reports: reports.slice(0, 3).map((r) => ({
        id: r.id,
        title: r.title,
        generatedAt: r.generatedAt,
      })),
      pendingSkills: skills
        .filter((s) => s.pendingIteration)
        .map((s) => ({ id: s.id, name: s.name })),
    });
  }, []);

  return (
    <div>
      <PageHeader
        title="概览"
        description={`${data.agentName} · 个人投资顾问 Agent · ${data.profileName}`}
        trailing={
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-lg bg-ios-blue px-4 text-[13px] font-medium text-white transition-colors hover:bg-ios-blueHover"
          >
            开始对话
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="已装 Skills" value={data.skills} hint="可在 Skills 页管理" />
        <Stat
          label="待迭代"
          value={data.pendingIter}
          hint={data.pendingIter > 0 ? "需要确认" : "无待办"}
        />
        <Stat label="自选标的" value={data.watch} hint="持续跟踪中" />
        <Stat label="记忆条目" value={data.memory} hint="跨会话沉淀" />
      </div>

      {data.pendingSkills.length > 0 && (
        <Card className="mt-6 border-2 border-ios-orange/40">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                Skill 迭代待确认
                <Pill tone="orange">{data.pendingSkills.length}</Pill>
              </span>
            }
            description="理小海发现部分 Skill 可升级，请逐项确认能力变化后再启用。"
            trailing={
              <Link
                href="/manage/skills"
                className="text-[13px] font-medium text-ios-blue hover:underline"
              >
                前往审核 →
              </Link>
            }
          />
          <ul className="space-y-2 text-[13px] text-slate-700 dark:text-slate-200">
            {data.pendingSkills.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg bg-ios-orange/8 px-3 py-2"
              >
                <span>{s.name}</span>
                <Pill tone="orange">待审核</Pill>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <ListGroup
          title="最近报告"
          footer="可在「报告」页查看完整历史，或立即生成新报告。"
        >
          {data.reports.length === 0 && (
            <ListRow primary="尚无报告" secondary="去「报告」页生成首份报告" />
          )}
          {data.reports.map((r) => (
            <ListRow
              key={r.id}
              primary={r.title}
              secondary={new Date(r.generatedAt).toLocaleString("zh-CN")}
              trailing="›"
            />
          ))}
        </ListGroup>

        <ListGroup title="快速入口">
          <ListRow
            leading={<Glyph>★</Glyph>}
            primary="新增自选标的"
            secondary="持续跟踪，自动出价值分析与买点建议"
            trailing={
              <Link
                href="/manage/watchlist"
                className="text-[13px] text-ios-blue"
              >
                进入 →
              </Link>
            }
          />
          <ListRow
            leading={<Glyph>◆</Glyph>}
            primary="浏览 Skill 目录"
            secondary="从 GitHub 拉取最佳实践 Skill"
            trailing={
              <Link
                href="/manage/skills"
                className="text-[13px] text-ios-blue"
              >
                进入 →
              </Link>
            }
          />
          <ListRow
            leading={<Glyph>◈</Glyph>}
            primary="审核风控边界"
            secondary="单标的上限 / 最大回撤 / 黑名单"
            trailing={
              <Link href="/manage/risk" className="text-[13px] text-ios-blue">
                进入 →
              </Link>
            }
          />
          <ListRow
            leading={<Glyph>◫</Glyph>}
            primary="查看 / 整理记忆"
            secondary="查看跨会话沉淀的偏好与研究"
            trailing={
              <Link
                href="/manage/memory"
                className="text-[13px] text-ios-blue"
              >
                进入 →
              </Link>
            }
          />
        </ListGroup>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Agent 状态"
          description="当前后端连接信息（仅在浏览器与服务端可见）。"
        />
        <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
          <Row label="Agent ID" value={<span className="font-mono">{data.agentId}</span>} />
          <Row label="模型 / System Prompt" value="由 Anthropic Console 配置" />
          <Row label="Memory" value="跨会话持久化（Anthropic Memory Stores）" />
          <Row label="对话状态" value="单一 Session，多轮上下文复用" />
        </dl>
      </Card>
    </div>
  );
}

function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ios-blue/10 text-[13px] text-ios-blue">
      {children}
    </span>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 py-2 last:border-b-0 dark:border-slate-800/60">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="truncate text-right text-slate-900 dark:text-slate-100">
        {value}
      </dd>
    </div>
  );
}
