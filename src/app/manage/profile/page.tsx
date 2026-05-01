"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { Card, CardHeader, PageHeader } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Input";
import {
  DEFAULT_PROFILE,
  UserProfile,
  loadProfile,
  saveProfile,
} from "@/lib/profile";

export default function ProfilePage() {
  const [p, setP] = useState<UserProfile>(DEFAULT_PROFILE);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setP(loadProfile());
  }, []);

  const set = <K extends keyof UserProfile>(k: K, v: UserProfile[K]) =>
    setP((prev) => ({ ...prev, [k]: v }));

  const onSave = () => {
    saveProfile(p);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const onReset = () => {
    if (confirm("恢复默认画像？已修改的内容将被覆盖。")) {
      setP(DEFAULT_PROFILE);
      saveProfile(DEFAULT_PROFILE);
    }
  };

  const totalRMB = p.realEstateRMB + p.liquidAssetsRMB;

  return (
    <div>
      <PageHeader
        title="个人画像"
        description="理小海会基于这份画像理解你的风险偏好、流动性需求与目标。所有内容仅保存在你的浏览器本地，并在对话时作为上下文传递。"
        trailing={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onReset}>
              恢复默认
            </Button>
            <Button onClick={onSave}>保存</Button>
          </div>
        }
      />

      {saved && (
        <div className="mb-4 rounded-lg bg-ios-green/10 px-3 py-2 text-[13px] font-medium text-ios-green">
          已保存。下次对话会自动带入新的画像上下文。
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title="基本身份" description="姓名 / 年龄 / 工作 / 家庭。" />
          <div className="space-y-4">
            <Field label="姓名 / 称呼">
              <Input
                value={p.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                placeholder="例如：张先生"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="年龄">
                <Input
                  type="number"
                  value={p.age}
                  onChange={(e) => set("age", Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="投资经验（年）">
                <Input
                  type="number"
                  value={p.investmentExperienceYears}
                  onChange={(e) =>
                    set(
                      "investmentExperienceYears",
                      Number(e.target.value) || 0,
                    )
                  }
                />
              </Field>
            </div>
            <Field label="工作 / 行业">
              <Input
                value={p.occupation}
                onChange={(e) => set("occupation", e.target.value)}
              />
            </Field>
            <Field label="居住与城市">
              <Input
                value={p.locations}
                onChange={(e) => set("locations", e.target.value)}
              />
            </Field>
            <Field label="家庭情况">
              <Textarea
                rows={3}
                value={p.family}
                onChange={(e) => set("family", e.target.value)}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="资产与持仓概览"
            description="单位：万人民币。仅用于本地推理与展示，不上传任何服务器。"
          />
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="不动产（含上海 / 新加坡）">
                <Input
                  type="number"
                  value={p.realEstateRMB}
                  onChange={(e) =>
                    set("realEstateRMB", Number(e.target.value) || 0)
                  }
                />
              </Field>
              <Field label="流动资产（现金 / 理财 / 股票）">
                <Input
                  type="number"
                  value={p.liquidAssetsRMB}
                  onChange={(e) =>
                    set("liquidAssetsRMB", Number(e.target.value) || 0)
                  }
                />
              </Field>
            </div>
            <div className="rounded-lg bg-ios-blue/10 px-3 py-2 text-[13px] text-ios-blue">
              估算总资产 ≈ <strong>{totalRMB.toLocaleString()} 万人民币</strong>
            </div>
            <Field label="主要持仓">
              <Textarea
                rows={2}
                value={p.primaryHoldings}
                onChange={(e) => set("primaryHoldings", e.target.value)}
              />
            </Field>
            <Field label="投资经历与偏好">
              <Textarea
                rows={4}
                value={p.investmentNotes}
                onChange={(e) => set("investmentNotes", e.target.value)}
              />
            </Field>
            <Field label="风险偏好（一句话）">
              <Input
                value={p.riskAppetite}
                onChange={(e) => set("riskAppetite", e.target.value)}
              />
            </Field>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="理小海会怎么用这份画像？"
          description="作为系统侧补充上下文，让风控、报告、分析的输出与你的人生阶段保持一致。"
        />
        <ul className="space-y-2 text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">
          <li className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ios-blue" />
            自动识别像「员工集中持股 BABA」这类组合层面的隐性风险，并在每次扫描时主动提醒。
          </li>
          <li className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ios-blue" />
            将你的现金流（新加坡 / 上海）、家庭支出节奏纳入流动性约束。
          </li>
          <li className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ios-blue" />
            对照你「不投 A 股、不碰高杠杆」等硬约束做事前过滤，避免无效建议。
          </li>
          <li className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ios-blue" />
            在儿子升学、新加坡 PR / 二代教育等节点，主动给出现金 / 美元 / 新币的再平衡建议。
          </li>
        </ul>
      </Card>
    </div>
  );
}
