"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { Card, CardHeader, PageHeader, Pill } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Toggle from "@/components/ui/Toggle";
import {
  Market,
  VERDICT_COLOR,
  VERDICT_LABEL,
  WatchItem,
  loadWatchlist,
  saveWatchlist,
} from "@/lib/watchlist";

const MARKET_LABEL: Record<Market, string> = {
  US: "美股",
  HK: "港股",
  SG: "新加坡",
  CRYPTO: "加密",
};

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState<WatchItem | null>(null);

  useEffect(() => {
    setItems(loadWatchlist());
  }, []);

  const persist = (next: WatchItem[]) => {
    setItems(next);
    saveWatchlist(next);
  };

  const totalAnalyzed = useMemo(
    () => items.filter((i) => i.latest).length,
    [items],
  );

  const setAlert = (id: string, on: boolean) =>
    persist(
      items.map((i) => (i.id === id ? { ...i, alertEnabled: on } : i)),
    );

  const remove = (id: string) => {
    if (!confirm("移除该自选标的？历史分析也会一并删除。")) return;
    persist(items.filter((i) => i.id !== id));
  };

  const addItem = (
    item: Omit<WatchItem, "id" | "trackedSince" | "alertEnabled" | "latest">,
  ) => {
    const id = item.ticker.toLowerCase().replace(/[^a-z0-9.]/g, "");
    if (!id || items.some((i) => i.id === id)) {
      alert("代码无效或已存在。");
      return;
    }
    const next: WatchItem = {
      ...item,
      id,
      trackedSince: new Date().toISOString().slice(0, 10),
      alertEnabled: true,
    };
    persist([next, ...items]);
    setAddOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="自选标的"
        description="指定理小海需要持续跟踪的标的，他会按设置的频率出价值分析与买点建议；硬约束（如不投 A 股）由风控页统一管理。"
        trailing={
          <div className="flex gap-2">
            <Button variant="secondary" disabled={items.length === 0}>
              立即扫描全部
            </Button>
            <Button onClick={() => setAddOpen(true)}>新增标的</Button>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3 md:grid-cols-4">
        <MiniStat label="跟踪数" value={items.length} />
        <MiniStat label="已分析" value={totalAnalyzed} />
        <MiniStat
          label="开启提醒"
          value={items.filter((i) => i.alertEnabled).length}
        />
        <MiniStat label="本周买点" value={2} hint="演示数据" />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <Th>代码</Th>
                <Th>名称 / 市场</Th>
                <Th>最近分析</Th>
                <Th>判断</Th>
                <Th>目标 / 止损</Th>
                <Th className="text-right">提醒</Th>
                <Th className="text-right">操作</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    还没有自选标的。点右上「新增标的」开始。
                  </td>
                </tr>
              )}
              {items.map((it) => (
                <tr
                  key={it.id}
                  className="text-slate-700 dark:text-slate-200"
                >
                  <td className="px-4 py-3 font-mono text-[13px] font-semibold">
                    {it.ticker}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {it.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {MARKET_LABEL[it.market]}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-slate-500">
                    {it.latest
                      ? new Date(it.latest.generatedAt).toLocaleString(
                          "zh-CN",
                        )
                      : "未分析"}
                  </td>
                  <td className="px-4 py-3">
                    {it.latest ? (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${VERDICT_COLOR[it.latest.verdict]}`}
                      >
                        {VERDICT_LABEL[it.latest.verdict]} ·{" "}
                        {Math.round(it.latest.confidence * 100)}%
                      </span>
                    ) : (
                      <Pill tone="neutral">—</Pill>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-slate-600 dark:text-slate-300">
                    {it.latest?.targetPrice ? (
                      <>
                        <span className="font-mono">
                          {it.latest.targetPrice}
                        </span>
                        {it.latest.stopLoss && (
                          <>
                            {" / "}
                            <span className="font-mono text-ios-red">
                              {it.latest.stopLoss}
                            </span>
                          </>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Toggle
                        checked={it.alertEnabled}
                        onChange={(v) => setAlert(it.id, v)}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDetail(it)}
                      >
                        分析
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => remove(it.id)}
                      >
                        移除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-3 text-[12px] text-slate-500 dark:text-slate-400">
        当前分析为示例数据。接入真实行情后，理小海会按风控页设定的频率自动刷新，并把买点 /
        止损 / 黑天鹅情景写入记忆。
      </p>

      <AddItemModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={addItem}
      />
      <DetailModal item={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function MiniStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-ios-lg bg-white px-4 py-3 shadow-card dark:bg-slate-900">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-[20px] font-semibold text-slate-900 dark:text-slate-50">
        {value}
      </div>
      {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`px-4 py-2.5 text-left font-medium ${className}`}>
      {children}
    </th>
  );
}

function AddItemModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (
    item: Omit<WatchItem, "id" | "trackedSince" | "alertEnabled" | "latest">,
  ) => void;
}) {
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [market, setMarket] = useState<Market>("US");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setTicker("");
    setName("");
    setMarket("US");
    setNotes("");
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="新增自选标的"
      description="理小海会持续跟踪此标的，并按风控设定生成价值分析与买点建议。"
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
          <Button
            onClick={() => {
              if (!ticker.trim() || !name.trim()) return;
              onAdd({
                ticker: ticker.trim().toUpperCase(),
                name: name.trim(),
                market,
                notes: notes.trim() || undefined,
              });
              reset();
            }}
            disabled={!ticker.trim() || !name.trim()}
          >
            添加
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="代码">
            <Input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="例如：AAPL / 0700.HK"
            />
          </Field>
          <Field label="市场">
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value as Market)}
              className="h-[38px] w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] outline-none focus:border-ios-blue focus:ring-2 focus:ring-ios-blue/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="US">美股</option>
              <option value="HK">港股</option>
              <option value="SG">新加坡</option>
              <option value="CRYPTO">加密</option>
            </select>
          </Field>
        </div>
        <Field label="名称">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：苹果 / 腾讯控股"
          />
        </Field>
        <Field
          label="备注 / 跟踪原因（可选）"
          hint="理小海会把这条备注作为分析时的上下文。"
        >
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="例如：长期看好云利润率改善，但需控制集中度。"
          />
        </Field>
      </div>
    </Modal>
  );
}

function DetailModal({
  item,
  onClose,
}: {
  item: WatchItem | null;
  onClose: () => void;
}) {
  if (!item) return null;
  const a = item.latest;
  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title={`${item.ticker} · ${item.name}`}
      description={
        a
          ? `生成于 ${new Date(a.generatedAt).toLocaleString("zh-CN")}`
          : "尚未生成分析"
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            关闭
          </Button>
          <Button>立即重新分析</Button>
        </>
      }
    >
      {!a ? (
        <p className="text-slate-500">
          尚未为该标的生成分析。点击「立即重新分析」让理小海现在就跑一份。
        </p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="blue">
              判断：{VERDICT_LABEL[a.verdict]} · 置信度{" "}
              {Math.round(a.confidence * 100)}%
            </Pill>
            {a.targetPrice && <Pill tone="green">目标价 {a.targetPrice}</Pill>}
            {a.stopLoss && <Pill tone="red">止损 {a.stopLoss}</Pill>}
          </div>

          <Section title="核心论点">
            <p className="leading-relaxed">{a.thesis}</p>
          </Section>

          <Section title="关键风险（辩证）">
            <ul className="space-y-2">
              {a.risks.map((r, i) => (
                <li
                  key={i}
                  className="flex gap-2 rounded-lg bg-ios-red/8 px-3 py-2 text-[13px] text-slate-700 dark:text-slate-200"
                >
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ios-red" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="潜在催化剂">
            <ul className="space-y-2">
              {a.catalysts.map((c, i) => (
                <li
                  key={i}
                  className="flex gap-2 rounded-lg bg-ios-green/8 px-3 py-2 text-[13px] text-slate-700 dark:text-slate-200"
                >
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ios-green" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </Section>

          {item.notes && (
            <Section title="你的备注">
              <p className="leading-relaxed text-slate-600 dark:text-slate-300">
                {item.notes}
              </p>
            </Section>
          )}
        </div>
      )}
    </Modal>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h4>
      {children}
    </div>
  );
}
