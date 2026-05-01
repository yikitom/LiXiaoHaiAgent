import { readJSON, writeJSON } from "./storage";

export type Market = "US" | "HK" | "SG" | "CRYPTO";
export type Verdict = "buy" | "accumulate" | "hold" | "reduce" | "watch";

export type Analysis = {
  generatedAt: string;
  verdict: Verdict;
  confidence: number; // 0..1
  targetPrice?: number;
  stopLoss?: number;
  thesis: string;
  risks: string[];
  catalysts: string[];
};

export type WatchItem = {
  id: string;
  ticker: string;
  name: string;
  market: Market;
  notes?: string;
  alertEnabled: boolean;
  trackedSince: string;
  latest?: Analysis;
};

export const SEED_WATCHLIST: WatchItem[] = [
  {
    id: "baba",
    ticker: "BABA",
    name: "阿里巴巴集团",
    market: "US",
    notes: "因公司 RSU 与员工持股计划，是天然集中持仓——重点关注集中度风险。",
    alertEnabled: true,
    trackedSince: "2026-04-01",
    latest: {
      generatedAt: "2026-04-30T22:30:00Z",
      verdict: "hold",
      confidence: 0.62,
      targetPrice: 132,
      stopLoss: 88,
      thesis:
        "云业务利润率改善 + 回购加速；但海外扩张与电商基本盘竞争激烈，估值已反映多数利好。",
      risks: [
        "中美关系恶化，ADR 退市风险（需关注 PCAOB 后续）",
        "国内消费复苏不及预期，淘天 GMV 增速承压",
        "员工集中持仓带来组合层面的单一标的暴露",
      ],
      catalysts: [
        "FY 末季报（云利润率与回购规模）",
        "AI Cloud 客户公告",
        "潜在子集团再上市",
      ],
    },
  },
  {
    id: "nvda",
    ticker: "NVDA",
    name: "NVIDIA",
    market: "US",
    alertEnabled: true,
    trackedSince: "2026-04-01",
    latest: {
      generatedAt: "2026-04-30T22:30:00Z",
      verdict: "watch",
      confidence: 0.55,
      thesis:
        "AI 资本开支峰值难以预测；当前估值需要持续超预期的数据中心收入。",
      risks: [
        "H200 / B200 供应链放量节奏",
        "超大规模买家自研 ASIC 抢份额",
        "出口管制升级对中国市场冲击",
      ],
      catalysts: ["GTC 后续路线图", "云厂商 capex 指引", "汽车 Drive 新合作"],
    },
  },
  {
    id: "msft",
    ticker: "MSFT",
    name: "微软",
    market: "US",
    alertEnabled: false,
    trackedSince: "2026-04-12",
  },
  {
    id: "700",
    ticker: "0700.HK",
    name: "腾讯控股",
    market: "HK",
    alertEnabled: false,
    trackedSince: "2026-04-12",
  },
  {
    id: "sgs-10y",
    ticker: "SGS-10Y",
    name: "新加坡 10Y 政府债",
    market: "SG",
    notes: "用于对比 UOB 结构性理财 4% 的真实风险溢价。",
    alertEnabled: false,
    trackedSince: "2026-04-12",
  },
];

const KEY = "lixiaohai-watchlist-v1";

export function loadWatchlist(): WatchItem[] {
  const stored = readJSON<WatchItem[] | null>(KEY, null);
  if (!stored) {
    writeJSON(KEY, SEED_WATCHLIST);
    return SEED_WATCHLIST;
  }
  return stored;
}

export function saveWatchlist(items: WatchItem[]) {
  writeJSON(KEY, items);
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  buy: "买入",
  accumulate: "分批加仓",
  hold: "持有",
  reduce: "减持",
  watch: "观察",
};

export const VERDICT_COLOR: Record<Verdict, string> = {
  buy: "bg-ios-green/15 text-ios-green",
  accumulate: "bg-ios-teal/15 text-ios-teal",
  hold: "bg-ios-blue/15 text-ios-blue",
  reduce: "bg-ios-orange/15 text-ios-orange",
  watch: "bg-slate-400/15 text-slate-500 dark:text-slate-400",
};
