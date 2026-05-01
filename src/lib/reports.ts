import { readJSON, writeJSON } from "./storage";

export type ReportType = "daily" | "weekly" | "monthly" | "ad_hoc";

export type ReportItem = {
  id: string;
  type: ReportType;
  title: string;
  generatedAt: string;
  summary: string;
  highlights: string[];
};

export type ReportSchedule = {
  daily: { enabled: boolean; hour: number };
  weekly: { enabled: boolean; weekday: number; hour: number };
  monthly: { enabled: boolean; day: number; hour: number };
  deliveryEmail: string;
  includeWatchlist: boolean;
  includeMacro: boolean;
  includeRiskCheck: boolean;
};

export const DEFAULT_SCHEDULE: ReportSchedule = {
  daily: { enabled: false, hour: 8 },
  weekly: { enabled: true, weekday: 1, hour: 9 },
  monthly: { enabled: true, day: 1, hour: 9 },
  deliveryEmail: "",
  includeWatchlist: true,
  includeMacro: true,
  includeRiskCheck: true,
};

export const SEED_REPORTS: ReportItem[] = [
  {
    id: "r-2026-04-w17",
    type: "weekly",
    title: "周报 · 2026 W17（4/21–4/27）",
    generatedAt: "2026-04-28T01:00:00Z",
    summary:
      "美股科技板块震荡上行，BABA 受云利润率改善预期支撑；SGS 10Y 收益率小幅回落，UOB 结构性理财相对优势缩窄。",
    highlights: [
      "BABA 周内 +3.4%，量能温和；建议保持持有",
      "NVDA 高位震荡，等待 capex 指引",
      "SGS 10Y -8bp，UOB 4% 结构性的风险溢价缩窄至 ~120bp",
    ],
  },
  {
    id: "r-2026-04",
    type: "monthly",
    title: "月报 · 2026 年 4 月",
    generatedAt: "2026-04-30T22:30:00Z",
    summary:
      "通胀温和回落，市场转向「软着陆」叙事；建议维持均衡配置，重点关注地缘政治冲击。",
    highlights: [
      "组合中 BABA 集中度仍偏高，建议在反弹中分批减持至 ≤ 25%",
      "新增「关税与供应链冲击」分析能力，对持仓做敏感度扫描",
      "现金管理：UOB vs SGS vs SSB 横向对比报告已生成",
    ],
  },
];

const SCHED_KEY = "lixiaohai-report-schedule-v1";
const REPORTS_KEY = "lixiaohai-reports-v1";

export function loadSchedule(): ReportSchedule {
  return {
    ...DEFAULT_SCHEDULE,
    ...readJSON<Partial<ReportSchedule>>(SCHED_KEY, {}),
  };
}

export function saveSchedule(s: ReportSchedule) {
  writeJSON(SCHED_KEY, s);
}

export function loadReports(): ReportItem[] {
  const stored = readJSON<ReportItem[] | null>(REPORTS_KEY, null);
  if (!stored) {
    writeJSON(REPORTS_KEY, SEED_REPORTS);
    return SEED_REPORTS;
  }
  return stored;
}

export function saveReports(items: ReportItem[]) {
  writeJSON(REPORTS_KEY, items);
}
