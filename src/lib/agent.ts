export type AgentConfig = {
  agentId: string;
  name: string;
  description: string;
  greeting: string;
};

export const DEFAULT_AGENT: AgentConfig = {
  agentId: "agent_011CabNgA9MEKd3p63BmR566",
  name: "理小海",
  description:
    "在 Anthropic Console 中配置的 Managed Agent —— 模型、System Prompt、工具都在 Console 端管理。",
  greeting:
    "你好呀，我是理小海 🌊 ——可以问我学习、写作、生活或者编程相关的问题，我会尽力帮你！",
};

export const AGENT_STORAGE_KEY = "lixiaohai-agent-config-v2";
export const CHAT_STORAGE_KEY = "lixiaohai-agent-chat-v2";
export const SESSION_STORAGE_KEY = "lixiaohai-agent-session-v1";

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
