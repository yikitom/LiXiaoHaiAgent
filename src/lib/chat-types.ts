/**
 * 客户端 Chat 状态模型。
 *
 * 关键约束：
 * 1. 每条 ChatMessage 一旦加入 messages 数组就不再修改（immutable）。
 *    Anthropic agent 一个 turn 会产生多条 agent.message 事件，每条独立成
 *    气泡——而不是把所有文字累加进一个气泡。这与 Anthropic Console、
 *    OpenAI Assistants UI、assistant-ui 等业界主流做法一致。
 * 2. 用 eventId 严格去重——重复轮询、cursor 漂移都不会重复渲染。
 * 3. 状态指示（"调用 web_search…"）是瞬态的 status，不进 messages。
 */

export type Role = "user" | "assistant" | "system";

export type ChatMessage = {
  /** 客户端本地 id（用于 React key） */
  id: string;
  /** Anthropic 事件 id，用于去重；user 本地消息可无 */
  eventId?: string;
  role: Role;
  content: string;
  /** ISO 时间戳 */
  createdAt: string;
};

/** 服务端轮询返回给客户端的"已转换"事件 */
export type ServerEvent =
  | { id: string; type: "delta"; text: string }
  | { id: string; type: "status"; text: string };

/** /api/chat 响应 */
export type SendResponse = {
  sessionId: string;
  sentEventId: string | null;
  sentCreatedAt: string | null;
  /** 客户端首次轮询的初始 cursor（new session = null = 拉所有事件） */
  cursorCreatedAt: string | null;
  vaultIds: string[] | null;
  error?: string;
  detail?: { invalidateSession?: boolean };
};

/** /api/chat/events 响应 */
export type PollResponse = {
  events: ServerEvent[];
  lastCreatedAt: string | null;
  isDone: boolean;
  isError: boolean;
  errorMessage?: string | null;
  invalidateSession?: boolean;
  error?: string;
};
