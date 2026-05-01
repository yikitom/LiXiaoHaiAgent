"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { Card, CardHeader, PageHeader, Pill } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Modal from "@/components/ui/Modal";
import Toggle from "@/components/ui/Toggle";
import {
  ReportItem,
  ReportSchedule,
  loadReports,
  loadSchedule,
  saveReports,
  saveSchedule,
} from "@/lib/reports";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export default function ReportsPage() {
  const [schedule, setSchedule] = useState<ReportSchedule | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [viewing, setViewing] = useState<ReportItem | null>(null);
  const [generating, setGenerating] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setSchedule(loadSchedule());
    setReports(loadReports());
  }, []);

  if (!schedule) return null;

  const updateSchedule = (s: ReportSchedule) => {
    setSchedule(s);
    saveSchedule(s);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1200);
  };

  const generateNow = async () => {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 900));
    const now = new Date();
    const next: ReportItem = {
      id: `r-${now.getTime()}`,
      type: "ad_hoc",
      title: `临时报告 · ${now.toLocaleString("zh-CN")}`,
      generatedAt: now.toISOString(),
      summary:
        "（演示）调用 Skills + 自选标的 + 风控约束，生成跨资产的快速复盘。",
      highlights: [
        "持仓集中度复盘：BABA 仍为最大单一标的",
        "美股板块切换：能源 / 医药近一周相对走强",
        "新加坡现金：UOB 4% 与 SGS 利差缩窄至 ~120bp",
      ],
    };
    const updated = [next, ...reports];
    setReports(updated);
    saveReports(updated);
    setGenerating(false);
  };

  return (
    <div>
      <PageHeader
        title="报告"
        description="按你的节奏出市场总览 + 自选标的复盘。理小海会把硬约束、记忆中的事实、最新 Skill 全部吸收进报告。"
        trailing={
          <Button onClick={generateNow} disabled={generating}>
            {generating ? "生成中…" : "立即生成"}
          </Button>
        }
      />

      {savedFlash && (
        <div className="mb-3 rounded-lg bg-ios-green/10 px-3 py-2 text-[13px] text-ios-green">
          已保存。
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader
            title="发送计划"
            description="日报 / 周报 / 月报独立开关，按你的工作节奏决定。"
          />
          <div className="space-y-3 text-[14px]">
            <ScheduleRow
              label="每日"
              hintLeft="每天上午"
              checked={schedule.daily.enabled}
              onCheck={(v) =>
                updateSchedule({
                  ...schedule,
                  daily: { ...schedule.daily, enabled: v },
                })
              }
            >
              <HourSelect
                value={schedule.daily.hour}
                onChange={(h) =>
                  updateSchedule({
                    ...schedule,
                    daily: { ...schedule.daily, hour: h },
                  })
                }
              />
            </ScheduleRow>
            <ScheduleRow
              label="每周"
              checked={schedule.weekly.enabled}
              onCheck={(v) =>
                updateSchedule({
                  ...schedule,
                  weekly: { ...schedule.weekly, enabled: v },
                })
              }
            >
              <select
                value={schedule.weekly.weekday}
                onChange={(e) =>
                  updateSchedule({
                    ...schedule,
                    weekly: {
                      ...schedule.weekly,
                      weekday: Number(e.target.value),
                    },
                  })
                }
                className={SELECT_CLASS}
              >
                {WEEKDAYS.map((d, i) => (
                  <option key={i} value={i}>
                    {d}
                  </option>
                ))}
              </select>
              <HourSelect
                value={schedule.weekly.hour}
                onChange={(h) =>
                  updateSchedule({
                    ...schedule,
                    weekly: { ...schedule.weekly, hour: h },
                  })
                }
              />
            </ScheduleRow>
            <ScheduleRow
              label="每月"
              checked={schedule.monthly.enabled}
              onCheck={(v) =>
                updateSchedule({
                  ...schedule,
                  monthly: { ...schedule.monthly, enabled: v },
                })
              }
            >
              <select
                value={schedule.monthly.day}
                onChange={(e) =>
                  updateSchedule({
                    ...schedule,
                    monthly: {
                      ...schedule.monthly,
                      day: Number(e.target.value),
                    },
                  })
                }
                className={SELECT_CLASS}
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d} 日
                  </option>
                ))}
              </select>
              <HourSelect
                value={schedule.monthly.hour}
                onChange={(h) =>
                  updateSchedule({
                    ...schedule,
                    monthly: { ...schedule.monthly, hour: h },
                  })
                }
              />
            </ScheduleRow>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="内容与投递"
            description="决定报告里包含哪些模块，以及推送渠道。"
          />
          <div className="space-y-3">
            <ContentToggle
              label="自选标的复盘"
              hint="覆盖每一个 watchlist 标的。"
              checked={schedule.includeWatchlist}
              onChange={(v) =>
                updateSchedule({ ...schedule, includeWatchlist: v })
              }
            />
            <ContentToggle
              label="宏观与跨资产"
              hint="美 / 中 / 新加坡三地大类资产对比。"
              checked={schedule.includeMacro}
              onChange={(v) =>
                updateSchedule({ ...schedule, includeMacro: v })
              }
            />
            <ContentToggle
              label="风控自检（辩证）"
              hint="对每条建议生成正反论证 + 触发条件。"
              checked={schedule.includeRiskCheck}
              onChange={(v) =>
                updateSchedule({ ...schedule, includeRiskCheck: v })
              }
            />
            <Field
              label="推送邮箱（可选）"
              hint="留空则只在控制台留存；填后会通过服务端发送（需配置邮件渠道）。"
            >
              <Input
                value={schedule.deliveryEmail}
                onChange={(e) =>
                  updateSchedule({
                    ...schedule,
                    deliveryEmail: e.target.value,
                  })
                }
                placeholder="you@example.com"
              />
            </Field>
          </div>
        </Card>
      </div>

      <ListGroup
        title="历史报告"
        footer="点击查看完整摘要；真实接入后可一键导出 PDF / 推送到邮箱。"
      >
        {reports.length === 0 && (
          <ListRow
            primary="尚无报告"
            secondary="点击右上「立即生成」创建首份报告"
          />
        )}
        {reports.map((r) => (
          <ListRow
            key={r.id}
            onClick={() => setViewing(r)}
            leading={<TypeBadge type={r.type} />}
            primary={r.title}
            secondary={r.summary}
            trailing={new Date(r.generatedAt).toLocaleString("zh-CN")}
          />
        ))}
      </ListGroup>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.title}
        description={
          viewing
            ? `生成于 ${new Date(viewing.generatedAt).toLocaleString("zh-CN")}`
            : ""
        }
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setViewing(null)}>
              关闭
            </Button>
            <Button>导出 PDF</Button>
          </>
        }
      >
        {viewing && (
          <div className="space-y-4">
            <p className="leading-relaxed">{viewing.summary}</p>
            <div>
              <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                亮点
              </h4>
              <ul className="space-y-2">
                {viewing.highlights.map((h, i) => (
                  <li
                    key={i}
                    className="flex gap-2 rounded-lg bg-slate-100 px-3 py-2 text-[13px] dark:bg-slate-800"
                  >
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ios-blue" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

const SELECT_CLASS =
  "h-9 rounded-lg border border-slate-200 bg-white px-2 text-[13px] outline-none focus:border-ios-blue dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

function HourSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (h: number) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={SELECT_CLASS}
    >
      {Array.from({ length: 24 }, (_, i) => i).map((h) => (
        <option key={h} value={h}>
          {h.toString().padStart(2, "0")}:00
        </option>
      ))}
    </select>
  );
}

function ScheduleRow({
  label,
  hintLeft,
  checked,
  onCheck,
  children,
}: {
  label: string;
  hintLeft?: string;
  checked: boolean;
  onCheck: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200/60 px-3 py-2.5 dark:border-slate-800/60">
      <Toggle checked={checked} onChange={onCheck} />
      <div className="flex-1">
        <div className="text-[13px] font-medium">{label}</div>
        {hintLeft && (
          <div className="text-[11px] text-slate-500">{hintLeft}</div>
        )}
      </div>
      <div className="flex flex-shrink-0 gap-2">{children}</div>
    </div>
  );
}

function ContentToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200/60 px-3 py-2.5 dark:border-slate-800/60">
      <div>
        <div className="text-[13px] font-medium">{label}</div>
        {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function TypeBadge({ type }: { type: ReportItem["type"] }) {
  const map = {
    daily: { tone: "blue" as const, label: "日报" },
    weekly: { tone: "indigo" as const, label: "周报" },
    monthly: { tone: "green" as const, label: "月报" },
    ad_hoc: { tone: "orange" as const, label: "临时" },
  };
  const cfg = map[type];
  return <Pill tone={cfg.tone}>{cfg.label}</Pill>;
}
