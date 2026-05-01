"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { Card, CardHeader, PageHeader, Pill } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Modal from "@/components/ui/Modal";
import Toggle from "@/components/ui/Toggle";
import { Skill, SkillSource, loadSkills, saveSkills } from "@/lib/skills";

type Tab = "installed" | "available" | "pending";

const SOURCE_LABEL: Record<SkillSource, string> = {
  anthropic: "Anthropic",
  github: "GitHub 社区",
  custom: "自定义",
};

const SOURCE_TONE: Record<
  SkillSource,
  "blue" | "indigo" | "neutral"
> = {
  anthropic: "indigo",
  github: "blue",
  custom: "neutral",
};

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [tab, setTab] = useState<Tab>("installed");
  const [refreshing, setRefreshing] = useState(false);
  const [iterTarget, setIterTarget] = useState<Skill | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    setSkills(loadSkills());
  }, []);

  const persist = (next: Skill[]) => {
    setSkills(next);
    saveSkills(next);
  };

  const installed = useMemo(
    () => skills.filter((s) => s.installed),
    [skills],
  );
  const available = useMemo(
    () => skills.filter((s) => !s.installed),
    [skills],
  );
  const pending = useMemo(
    () => skills.filter((s) => s.pendingIteration),
    [skills],
  );

  const setInstalled = (id: string, on: boolean) => {
    persist(
      skills.map((s) =>
        s.id === id
          ? {
              ...s,
              installed: on,
              installedAt: on
                ? s.installedAt ?? new Date().toISOString()
                : s.installedAt,
            }
          : s,
      ),
    );
  };

  const acceptIteration = (id: string) => {
    persist(
      skills.map((s) =>
        s.id === id && s.pendingIteration
          ? {
              ...s,
              version: s.pendingIteration.toVersion,
              capabilities: s.capabilities, // would merge in real impl
              pendingIteration: undefined,
            }
          : s,
      ),
    );
    setIterTarget(null);
  };

  const rejectIteration = (id: string) => {
    persist(
      skills.map((s) =>
        s.id === id ? { ...s, pendingIteration: undefined } : s,
      ),
    );
    setIterTarget(null);
  };

  const refreshCatalog = async () => {
    setRefreshing(true);
    // 实际实现：服务端拉取 GitHub Skill 索引并 diff 本地清单。
    // 这里仅模拟一次延迟，真实接入后会出现新的 Skill 推荐。
    await new Promise((r) => setTimeout(r, 700));
    setRefreshing(false);
  };

  const removeSkill = (id: string) => {
    if (!confirm("确认从清单中移除该 Skill？")) return;
    persist(skills.filter((s) => s.id !== id));
  };

  const addCustom = (skill: Omit<Skill, "id" | "installed" | "source">) => {
    const id = skill.name.toLowerCase().replace(/\s+/g, "-").slice(0, 60);
    const next: Skill = {
      ...skill,
      id,
      source: "custom",
      installed: true,
      installedAt: new Date().toISOString(),
    };
    persist([next, ...skills]);
    setAddOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Skills 技能"
        description="为理小海装配「能力包」。可从 Anthropic / GitHub 推荐目录一键安装，也可手工添加；Skill 的版本迭代必须经过你确认才会生效。"
        trailing={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={refreshCatalog}
              disabled={refreshing}
            >
              {refreshing ? "刷新中…" : "刷新 GitHub 目录"}
            </Button>
            <Button onClick={() => setAddOpen(true)}>添加自定义 Skill</Button>
          </div>
        }
      />

      <SegmentedTabs
        tab={tab}
        onChange={setTab}
        counts={{
          installed: installed.length,
          available: available.length,
          pending: pending.length,
        }}
      />

      {tab === "pending" && pending.length === 0 && (
        <EmptyState
          title="没有待迭代的 Skill"
          hint="理小海会持续学习并对已装 Skill 提交升级建议；任何能力变化都会出现在这里等待你确认。"
        />
      )}

      {tab === "pending" && pending.length > 0 && (
        <div className="space-y-3">
          {pending.map((s) => (
            <PendingCard
              key={s.id}
              skill={s}
              onReview={() => setIterTarget(s)}
            />
          ))}
        </div>
      )}

      {tab === "installed" && (
        <SkillGrid>
          {installed.length === 0 && (
            <EmptyState
              title="尚未安装任何 Skill"
              hint="去「可安装」页选择推荐能力，或手工添加自定义 Skill。"
            />
          )}
          {installed.map((s) => (
            <SkillCard
              key={s.id}
              skill={s}
              onToggle={(v) => setInstalled(s.id, v)}
              onIterate={() => setIterTarget(s)}
              onRemove={() => removeSkill(s.id)}
            />
          ))}
        </SkillGrid>
      )}

      {tab === "available" && (
        <SkillGrid>
          {available.length === 0 && (
            <EmptyState
              title="目录已全部启用"
              hint="如需新能力，可点击右上「刷新 GitHub 目录」抓取最新推荐，或手工添加。"
            />
          )}
          {available.map((s) => (
            <SkillCard
              key={s.id}
              skill={s}
              onToggle={(v) => setInstalled(s.id, v)}
              onRemove={() => removeSkill(s.id)}
            />
          ))}
        </SkillGrid>
      )}

      <IterationModal
        skill={iterTarget}
        onClose={() => setIterTarget(null)}
        onAccept={() => iterTarget && acceptIteration(iterTarget.id)}
        onReject={() => iterTarget && rejectIteration(iterTarget.id)}
      />

      <AddSkillModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={addCustom}
      />
    </div>
  );
}

function SegmentedTabs({
  tab,
  onChange,
  counts,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
  counts: { installed: number; available: number; pending: number };
}) {
  const items: { key: Tab; label: string; count: number }[] = [
    { key: "installed", label: "已安装", count: counts.installed },
    { key: "available", label: "可安装", count: counts.available },
    { key: "pending", label: "待迭代", count: counts.pending },
  ];
  return (
    <div className="mb-5 inline-flex rounded-lg bg-slate-200/80 p-1 dark:bg-slate-800/60">
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
            tab === it.key
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
          }`}
        >
          {it.label}
          {it.count > 0 && (
            <span
              className={`rounded-full px-1.5 text-[11px] ${
                it.key === "pending" && it.count > 0
                  ? "bg-ios-orange/20 text-ios-orange"
                  : "bg-slate-300/70 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
              }`}
            >
              {it.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function SkillGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>;
}

function SkillCard({
  skill,
  onToggle,
  onIterate,
  onRemove,
}: {
  skill: Skill;
  onToggle: (v: boolean) => void;
  onIterate?: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="rounded-ios-lg bg-white p-5 shadow-card dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold text-slate-900 dark:text-slate-100">
              {skill.name}
            </h3>
            <Pill tone={SOURCE_TONE[skill.source]}>
              {SOURCE_LABEL[skill.source]}
            </Pill>
            <Pill tone="neutral">v{skill.version}</Pill>
            {skill.pendingIteration && (
              <Pill tone="orange">可升级 → v{skill.pendingIteration.toVersion}</Pill>
            )}
          </div>
          {skill.repo && (
            <div className="mt-1 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
              {skill.repo}
            </div>
          )}
        </div>
        <Toggle checked={skill.installed} onChange={onToggle} />
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
        {skill.description}
      </p>
      <ul className="mt-3 space-y-1.5 text-[12px] text-slate-600 dark:text-slate-300">
        {skill.capabilities.map((c, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-ios-blue" />
            <span>{c}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between text-[12px] text-slate-500">
        <span>
          {skill.installedAt
            ? `已安装 · ${new Date(skill.installedAt).toLocaleDateString("zh-CN")}`
            : "未安装"}
        </span>
        <div className="flex gap-1">
          {skill.pendingIteration && onIterate && (
            <Button size="sm" variant="ghost" onClick={onIterate}>
              查看迭代
            </Button>
          )}
          {onRemove && (
            <Button size="sm" variant="destructive" onClick={onRemove}>
              移除
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function PendingCard({
  skill,
  onReview,
}: {
  skill: Skill;
  onReview: () => void;
}) {
  const it = skill.pendingIteration!;
  return (
    <Card className="border-l-4 border-l-ios-orange">
      <CardHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {skill.name}
            <Pill tone="orange">
              v{it.fromVersion} → v{it.toVersion}
            </Pill>
          </span>
        }
        description={`提交时间：${new Date(it.proposedAt).toLocaleString("zh-CN")}`}
        trailing={<Button onClick={onReview}>审核</Button>}
      />
      <p className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">
        {it.summary}
      </p>
    </Card>
  );
}

function IterationModal({
  skill,
  onClose,
  onAccept,
  onReject,
}: {
  skill: Skill | null;
  onClose: () => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  if (!skill) return null;
  const it = skill.pendingIteration;
  return (
    <Modal
      open={!!skill}
      onClose={onClose}
      title={`Skill 迭代 · ${skill.name}`}
      description={
        it
          ? `${skill.name} 由 v${it.fromVersion} 升级到 v${it.toVersion}。请逐项确认能力变化后再启用。`
          : `${skill.name} · v${skill.version}`
      }
      size="lg"
      footer={
        it ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              稍后处理
            </Button>
            <Button variant="destructive" onClick={onReject}>
              拒绝此次迭代
            </Button>
            <Button onClick={onAccept}>确认并启用 v{it.toVersion}</Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            关闭
          </Button>
        )
      }
    >
      {it ? (
        <div className="space-y-5">
          <div>
            <h4 className="mb-2 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
              核心变化摘要
            </h4>
            <p className="leading-relaxed text-slate-700 dark:text-slate-200">
              {it.summary}
            </p>
          </div>
          <div>
            <h4 className="mb-2 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
              能力差异
            </h4>
            <ul className="space-y-2">
              {it.changes.map((c, i) => (
                <li
                  key={i}
                  className="flex gap-2 rounded-lg bg-slate-100 px-3 py-2 text-[13px] dark:bg-slate-800"
                >
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ios-orange" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg bg-ios-blue/8 p-3 text-[12px] leading-relaxed text-slate-700 dark:text-slate-200">
            提示：迭代会改变理小海下次回答的逻辑。建议在重要交易窗口前先用「报告」页跑一份小测试。
          </div>
        </div>
      ) : (
        <p>此 Skill 当前无可用迭代。</p>
      )}
    </Modal>
  );
}

function AddSkillModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (s: Omit<Skill, "id" | "installed" | "source">) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState("0.1.0");
  const [capsRaw, setCapsRaw] = useState("");
  const [repo, setRepo] = useState("");

  const reset = () => {
    setName("");
    setDescription("");
    setVersion("0.1.0");
    setCapsRaw("");
    setRepo("");
  };

  const submit = () => {
    if (!name.trim() || !description.trim()) return;
    onAdd({
      name: name.trim(),
      description: description.trim(),
      version: version.trim() || "0.1.0",
      repo: repo.trim() || undefined,
      capabilities: capsRaw
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    reset();
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="添加自定义 Skill"
      description="把你自己的私有 SKILL.md 接入理小海。新建后默认启用。"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            取消
          </Button>
          <Button onClick={submit} disabled={!name.trim() || !description.trim()}>
            创建并启用
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="名称">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：阿里员工持股集中度审查"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="版本">
            <Input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="0.1.0"
            />
          </Field>
          <Field label="仓库 / 来源（可选）">
            <Input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="my-org/skills/..."
            />
          </Field>
        </div>
        <Field label="一句话描述">
          <Textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field label="能力清单（每行一条）">
          <Textarea
            rows={4}
            value={capsRaw}
            onChange={(e) => setCapsRaw(e.target.value)}
            placeholder={
              "扫描组合中员工持股权重\n触发去集中度建议\n输出分批减持时间表"
            }
          />
        </Field>
      </div>
    </Modal>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <Card className="text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-ios-blue/10 text-ios-blue">
        ◆
      </div>
      <div className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </div>
      <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
        {hint}
      </p>
    </Card>
  );
}
