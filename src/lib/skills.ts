import { readJSON, writeJSON } from "./storage";

export type SkillSource = "anthropic" | "github" | "custom";

export type SkillIteration = {
  fromVersion: string;
  toVersion: string;
  summary: string;
  changes: string[];
  proposedAt: string;
};

export type Skill = {
  id: string;
  name: string;
  source: SkillSource;
  repo?: string;
  version: string;
  description: string;
  capabilities: string[];
  installed: boolean;
  installedAt?: string;
  pendingIteration?: SkillIteration;
};

export const SEED_SKILLS: Skill[] = [
  {
    id: "value-investing-checklist",
    name: "Value Investing Checklist",
    source: "github",
    repo: "anthropics/skills/finance/value-investing-checklist",
    version: "1.4.2",
    description:
      "巴菲特式价值投资 12 项检查清单：护城河、ROIC、负债结构、自由现金流、估值缓冲。",
    capabilities: [
      "对单一标的执行 12 项硬性检查",
      "输出弱项清单与跟踪要点",
      "辨识价值陷阱（增长停滞 / 行业衰退）",
    ],
    installed: true,
    installedAt: "2026-04-12T08:00:00Z",
    pendingIteration: {
      fromVersion: "1.4.2",
      toVersion: "1.5.0",
      summary:
        "新增「关税与地缘政治情景模拟」步骤；护城河评估细化为 5 个维度（成本 / 网络 / 转换成本 / 无形 / 规模）。",
      changes: [
        "新增 §13 地缘政治压力测试：基于关税、出口管制、供应链转移三类情景",
        "护城河评估由 1 维 → 5 维（含权重）",
        "调整通胀假设默认值 2.5% → 3.0%",
      ],
      proposedAt: "2026-04-29T09:00:00Z",
    },
  },
  {
    id: "10k-extractor",
    name: "10-K Filing Extractor",
    source: "github",
    repo: "anthropics/skills/finance/10k-extractor",
    version: "0.9.0",
    description:
      "解析 SEC 10-K / 20-F 年报，结构化提取关键风险、收入分部、会计政策变化、存货周转。",
    capabilities: [
      "自动定位 Risk Factors / MD&A / Footnotes",
      "对比同公司过去 3 年的差异",
      "标记审计意见与会计政策异常",
    ],
    installed: true,
    installedAt: "2026-04-15T03:00:00Z",
  },
  {
    id: "options-flow-tracker",
    name: "Options Flow Tracker",
    source: "github",
    repo: "community/skills/options-flow-tracker",
    version: "0.6.1",
    description:
      "跟踪美股大单期权流，标记 unusual activity、潜在隐含波动率拐点。",
    capabilities: [
      "聚合 CBOE 数据并去噪",
      "对持仓标的实时告警",
      "结合财报日历给出权重",
    ],
    installed: false,
  },
  {
    id: "dialectical-risk",
    name: "Dialectical Risk Review",
    source: "anthropic",
    version: "2.0.0",
    description:
      "辩证风控：每条买入建议都生成正反两套论证、3 个失败情景与触发止损条件。",
    capabilities: [
      "强制生成反向论证",
      "黑天鹅情景头脑风暴（≥3 条）",
      "明确止损 / 减仓触发条件",
    ],
    installed: true,
    installedAt: "2026-04-10T03:00:00Z",
  },
  {
    id: "macro-regime",
    name: "Macro Regime Classifier",
    source: "github",
    repo: "anthropics/skills/macro/regime",
    version: "1.1.0",
    description:
      "将当前宏观环境归类（再通胀 / 滞胀 / 衰退 / 软着陆）并输出大类资产权重建议。",
    capabilities: [
      "实时读取关键宏观指标",
      "输出大类资产配置建议",
      "对当前持仓做相对位置评估",
    ],
    installed: false,
  },
  {
    id: "sg-mas-bond",
    name: "新加坡 MAS / SGS 债券分析",
    source: "github",
    repo: "community/skills/sg-mas-bond",
    version: "0.3.0",
    description:
      "针对新加坡 MAS Bills / SGS / SSB 的收益率曲线分析，对比 UOB / DBS 结构性理财。",
    capabilities: [
      "拉取 SGS 拍卖结果",
      "横向对比银行结构性产品",
      "输出现金管理替代方案",
    ],
    installed: false,
  },
  {
    id: "tariff-impact",
    name: "关税与供应链冲击分析",
    source: "github",
    repo: "community/skills/tariff-impact",
    version: "0.2.4",
    description:
      "针对中美贸易冲突、关税升级，对持仓标的做敏感度分析与替代供应链评估。",
    capabilities: [
      "公司收入地区分布扫描",
      "供应链上下游冲击评估",
      "输出 30/90 天行动清单",
    ],
    installed: false,
  },
];

const KEY = "lixiaohai-skills-v1";

export function loadSkills(): Skill[] {
  const stored = readJSON<Skill[] | null>(KEY, null);
  if (!stored) {
    writeJSON(KEY, SEED_SKILLS);
    return SEED_SKILLS;
  }
  return stored;
}

export function saveSkills(skills: Skill[]) {
  writeJSON(KEY, skills);
}
