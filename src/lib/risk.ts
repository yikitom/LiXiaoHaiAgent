import { readJSON, writeJSON } from "./storage";

export type RiskProfile = {
  riskTolerance: number; // 0..100
  horizonYears: number;
  liquidityNeed: number; // 0..100
  maxSinglePositionPct: number;
  maxAssetClassPct: number;
  maxDrawdownPct: number;
  excludedAssets: string[];
  dialecticalAnalysis: boolean;
  blackSwanScenarios: boolean;
  diversificationCheck: boolean;
  requireConfirmAboveAmount: number; // 万人民币
};

export const DEFAULT_RISK: RiskProfile = {
  riskTolerance: 55,
  horizonYears: 10,
  liquidityNeed: 35,
  maxSinglePositionPct: 25,
  maxAssetClassPct: 50,
  maxDrawdownPct: 20,
  excludedAssets: ["A 股", "P2P", "高杠杆衍生品"],
  dialecticalAnalysis: true,
  blackSwanScenarios: true,
  diversificationCheck: true,
  requireConfirmAboveAmount: 100,
};

const KEY = "lixiaohai-risk-v1";

export function loadRisk(): RiskProfile {
  return { ...DEFAULT_RISK, ...readJSON<Partial<RiskProfile>>(KEY, {}) };
}

export function saveRisk(r: RiskProfile) {
  writeJSON(KEY, r);
}
