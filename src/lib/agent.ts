export type AgentConfig = {
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  greeting: string;
};

export const AVAILABLE_MODELS: { id: string; label: string; note?: string }[] =
  [
    { id: "claude-opus-4-7", label: "Claude Opus 4.7", note: "最强能力" },
    {
      id: "claude-sonnet-4-6",
      label: "Claude Sonnet 4.6",
      note: "速度与能力平衡",
    },
    {
      id: "claude-haiku-4-5-20251001",
      label: "Claude Haiku 4.5",
      note: "极速、低成本",
    },
  ];

export const DEFAULT_AGENT: AgentConfig = {
  name: "李小海",
  description:
    "李小海是一位贴心、懂海洋知识的中文 AI 助手，热爱回答与日常生活、写作和学习相关的问题。",
  systemPrompt: [
    "你是『李小海』，一位用中文交流的友善 AI 助手。",
    "性格设定：阳光、耐心、善于倾听，回答简洁但有温度，喜欢用形象的比喻。",
    "回答原则：",
    "1. 默认使用简体中文。如果用户用其他语言提问，跟随用户。",
    "2. 给出准确、可执行的建议；不确定时坦诚说明。",
    "3. 涉及代码时，使用 Markdown 代码块并标明语言。",
    "4. 回答尽量结构化，必要时使用列表或小标题。",
  ].join("\n"),
  model: "claude-opus-4-7",
  temperature: 0.7,
  maxTokens: 2048,
  greeting:
    "你好呀，我是李小海 🌊 ——可以问我学习、写作、生活或者编程相关的问题，我会尽力帮你！",
};

export const AGENT_STORAGE_KEY = "lixiaohai-agent-config-v1";
export const CHAT_STORAGE_KEY = "lixiaohai-agent-chat-v1";

export function loadAgent(): AgentConfig {
  if (typeof window === "undefined") return DEFAULT_AGENT;
  try {
    const raw = window.localStorage.getItem(AGENT_STORAGE_KEY);
    if (!raw) return DEFAULT_AGENT;
    const parsed = JSON.parse(raw) as Partial<AgentConfig>;
    return { ...DEFAULT_AGENT, ...parsed };
  } catch {
    return DEFAULT_AGENT;
  }
}

export function saveAgent(cfg: AgentConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify(cfg));
}
