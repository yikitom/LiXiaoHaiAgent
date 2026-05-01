"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { Card, CardHeader, PageHeader, Pill } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import Toggle from "@/components/ui/Toggle";
import { DEFAULT_RISK, RiskProfile, loadRisk, saveRisk } from "@/lib/risk";

export default function RiskPage() {
  const [r, setR] = useState<RiskProfile>(DEFAULT_RISK);
  const [newExclude, setNewExclude] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setR(loadRisk());
  }, []);

  const persist = (next: RiskProfile) => {
    setR(next);
    saveRisk(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };

  const set = <K extends keyof RiskProfile>(k: K, v: RiskProfile[K]) =>
    persist({ ...r, [k]: v });

  const addExclude = () => {
    const v = newExclude.trim();
    if (!v || r.excludedAssets.includes(v)) return;
    persist({ ...r, excludedAssets: [...r.excludedAssets, v] });
    setNewExclude("");
  };

  const removeExclude = (v: string) =>
    persist({
      ...r,
      excludedAssets: r.excludedAssets.filter((x) => x !== v),
    });

  return (
    <div>
      <PageHeader
        title="风控"
        description="科学 / 完整 / 辩证的风控边界。所有交易建议都会先过这套约束，再决定是否输出。"
        trailing={
          <Button
            variant="secondary"
            onClick={() => {
              if (confirm("恢复风控默认设定？")) persist(DEFAULT_RISK);
            }}
          >
            恢复默认
          </Button>
        }
      />

      {saved && (
        <div className="mb-3 rounded-lg bg-ios-green/10 px-3 py-2 text-[13px] text-ios-green">
          已保存，立即生效。
        </div>
      )}

      <Card>
        <CardHeader
          title="风险偏好"
          description="决定理小海给建议时的进攻 / 防守倾向。"
        />
        <div className="space-y-5">
          <SliderField
            label="风险承受度"
            value={r.riskTolerance}
            onChange={(v) => set("riskTolerance", v)}
            min={0}
            max={100}
            unit="/100"
            leftLabel="保守"
            rightLabel="进取"
          />
          <SliderField
            label="投资期限"
            value={r.horizonYears}
            onChange={(v) => set("horizonYears", v)}
            min={1}
            max={30}
            unit=" 年"
            leftLabel="短"
            rightLabel="长"
          />
          <SliderField
            label="流动性需求"
            value={r.liquidityNeed}
            onChange={(v) => set("liquidityNeed", v)}
            min={0}
            max={100}
            unit="/100"
            leftLabel="可锁仓"
            rightLabel="随时取用"
          />
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="组合层硬约束"
          description="任何超过约束的建议会被自动拒绝并提示原因。"
        />
        <div className="grid gap-4 md:grid-cols-3">
          <SliderField
            label="单一标的上限"
            value={r.maxSinglePositionPct}
            onChange={(v) => set("maxSinglePositionPct", v)}
            min={5}
            max={50}
            unit="%"
          />
          <SliderField
            label="单一资产类别上限"
            value={r.maxAssetClassPct}
            onChange={(v) => set("maxAssetClassPct", v)}
            min={20}
            max={80}
            unit="%"
          />
          <SliderField
            label="组合最大回撤容忍"
            value={r.maxDrawdownPct}
            onChange={(v) => set("maxDrawdownPct", v)}
            min={5}
            max={50}
            unit="%"
          />
        </div>
        <Field
          label="单笔交易超过此金额需二次确认（万人民币）"
          hint="超过该金额时，理小海会在下达建议前要求你显式确认。"
        >
          <Input
            type="number"
            value={r.requireConfirmAboveAmount}
            onChange={(e) =>
              set(
                "requireConfirmAboveAmount",
                Math.max(0, Number(e.target.value) || 0),
              )
            }
          />
        </Field>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="资产黑名单"
          description="理小海永不主动建议的标的或资产类别。"
        />
        <div className="mb-3 flex flex-wrap gap-2">
          {r.excludedAssets.map((x) => (
            <button
              key={x}
              onClick={() => removeExclude(x)}
              className="group inline-flex items-center gap-1.5 rounded-full bg-ios-red/10 px-3 py-1 text-[12px] font-medium text-ios-red transition-colors hover:bg-ios-red/15"
            >
              {x}
              <span className="text-[14px] leading-none opacity-60 group-hover:opacity-100">
                ×
              </span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newExclude}
            onChange={(e) => setNewExclude(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addExclude();
              }
            }}
            placeholder="输入要拉黑的资产，例如：高杠杆 ETF"
          />
          <Button onClick={addExclude} disabled={!newExclude.trim()}>
            加入
          </Button>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="辩证风控"
          description="对每条建议附加正反论证、黑天鹅情景、组合层影响。"
        />
        <div className="space-y-3">
          <SwitchRow
            label="正反辩证（必出）"
            hint="对每条买入 / 减持建议生成相反论点；论点强度低于阈值时不出建议。"
            checked={r.dialecticalAnalysis}
            onChange={(v) => set("dialecticalAnalysis", v)}
          />
          <SwitchRow
            label="黑天鹅情景头脑风暴"
            hint="≥ 3 条情景（含触发条件、对组合的冲击、止损动作）。"
            checked={r.blackSwanScenarios}
            onChange={(v) => set("blackSwanScenarios", v)}
          />
          <SwitchRow
            label="组合层去集中度检查"
            hint="给单笔建议前，先评估对整个组合的集中度 / 相关性影响。"
            checked={r.diversificationCheck}
            onChange={(v) => set("diversificationCheck", v)}
          />
        </div>
      </Card>

      <Card className="mt-6 border-2 border-ios-orange/30">
        <CardHeader
          title="重要原则"
          description="理小海最终输出的建议会显式标注出风控判定结果。"
        />
        <ul className="space-y-2 text-[13px] leading-relaxed">
          <li className="flex gap-2">
            <Pill tone="orange">硬约束</Pill>
            <span>
              违反硬约束（黑名单 / 单标的上限 / 杠杆）会被直接拦截，不会出现在建议里。
            </span>
          </li>
          <li className="flex gap-2">
            <Pill tone="blue">辩证</Pill>
            <span>
              所有建议必须附正反论证 + 黑天鹅情景；置信度低于 0.4 自动转为「观察」。
            </span>
          </li>
          <li className="flex gap-2">
            <Pill tone="green">退出</Pill>
            <span>
              所有买入建议必须给出止损 / 减仓触发条件；任何「无止损」都会被拒绝。
            </span>
          </li>
        </ul>
      </Card>
    </div>
  );
}

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  unit,
  leftLabel,
  rightLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  unit?: string;
  leftLabel?: string;
  rightLabel?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
          {label}
        </span>
        <span className="text-[13px] font-semibold tabular-nums text-ios-blue">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        className="ios-slider"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {(leftLabel || rightLabel) && (
        <div className="mt-1 flex justify-between text-[11px] text-slate-500">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}
    </div>
  );
}

function SwitchRow({
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
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200/60 px-3 py-3 dark:border-slate-800/60">
      <div>
        <div className="text-[13px] font-medium">{label}</div>
        {hint && (
          <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            {hint}
          </div>
        )}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}
