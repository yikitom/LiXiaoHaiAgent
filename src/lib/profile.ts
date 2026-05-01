import { readJSON, writeJSON } from "./storage";

export type UserProfile = {
  fullName: string;
  age: number;
  occupation: string;
  locations: string;
  family: string;
  // 资产，单位：万人民币
  realEstateRMB: number;
  liquidAssetsRMB: number;
  primaryHoldings: string;
  investmentExperienceYears: number;
  investmentNotes: string;
  riskAppetite: string;
};

export const DEFAULT_PROFILE: UserProfile = {
  fullName: "",
  age: 45,
  occupation: "阿里巴巴飞猪平台 · 管理层",
  locations: "上海 / 新加坡（父母在南京）",
  family:
    "妻子从事互联网设计；儿子在上海读高一；父母常住南京；家庭重心在上海与新加坡。",
  realEstateRMB: 5000,
  liquidAssetsRMB: 2000,
  primaryHoldings:
    "阿里巴巴美股 (BABA) / UOB 银行结构性理财（年化约 4%）",
  investmentExperienceYears: 20,
  investmentNotes:
    "20 年股票经验，A 股+权证起步；2013 年比特币持仓约 1 年；不再投资 A 股；持续关注美股但精力有限；当前主要持有阿里美股与 UOB 理财。",
  riskAppetite: "中等偏稳健，重视全球分散与现金流，避免高杠杆。",
};

const KEY = "lixiaohai-profile-v1";

export function loadProfile(): UserProfile {
  return { ...DEFAULT_PROFILE, ...readJSON<Partial<UserProfile>>(KEY, {}) };
}

export function saveProfile(p: UserProfile) {
  writeJSON(KEY, p);
}
