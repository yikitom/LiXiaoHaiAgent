import { readJSON, writeJSON } from "./storage";

export type MemoryEntry = {
  id: string;
  path: string;
  size: number;
  updatedAt: string;
  preview: string;
  source: "seeded" | "conversation" | "manual";
};

export const SEED_MEMORY: MemoryEntry[] = [
  {
    id: "m1",
    path: "/profile/identity.md",
    size: 412,
    updatedAt: "2026-04-21T01:00:00Z",
    preview:
      "用户为飞猪平台管理层，家庭重心上海+新加坡，重视全球分散与现金流。",
    source: "seeded",
  },
  {
    id: "m2",
    path: "/preferences/no-a-shares.md",
    size: 96,
    updatedAt: "2026-04-21T01:00:00Z",
    preview: "硬性约束：不投资 A 股。理由：长期跟踪后认为定价机制不透明。",
    source: "seeded",
  },
  {
    id: "m3",
    path: "/holdings/concentration-risk-baba.md",
    size: 286,
    updatedAt: "2026-04-28T13:30:00Z",
    preview:
      "因 RSU 长期累积，BABA 占流动资产权重过高，需在每次组合扫描时输出去集中度建议。",
    source: "conversation",
  },
  {
    id: "m4",
    path: "/strategies/uob-vs-sgs.md",
    size: 540,
    updatedAt: "2026-04-29T07:30:00Z",
    preview:
      "UOB 4% 结构性需对比 SGS / SSB 真实收益，注意挂钩标的（票息条件+敲入条件）。",
    source: "conversation",
  },
  {
    id: "m5",
    path: "/research/btc-2013-lessons.md",
    size: 184,
    updatedAt: "2026-04-22T09:00:00Z",
    preview:
      "用户 2013 年比特币持仓 1 年；偏好高确信度、长期持有；不参与短线投机。",
    source: "conversation",
  },
];

const KEY = "lixiaohai-memory-v1";

export function loadMemory(): MemoryEntry[] {
  const stored = readJSON<MemoryEntry[] | null>(KEY, null);
  if (!stored) {
    writeJSON(KEY, SEED_MEMORY);
    return SEED_MEMORY;
  }
  return stored;
}

export function saveMemory(entries: MemoryEntry[]) {
  writeJSON(KEY, entries);
}
