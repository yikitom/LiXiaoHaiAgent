# 理小海 Agent 控制台

一个用于**管理**和**对话** Anthropic **Managed Agent** *理小海* 的极简前端：

- Agent (`agent_011CabNgA9MEKd3p63BmR566`) 在 Anthropic Console 中已配置好（模型、System Prompt、Skills、MCP 工具）。
- 本前端只负责创建 Session、转发用户消息、流式呈现 `agent.message` 事件。

技术栈：Next.js 16 + React 19 + Tailwind 3 + `@anthropic-ai/sdk` (beta managed-agents API)。

## 功能

- **对话页 `/`**：流式 SSE 与理小海多轮对话，自动维护 Session ID（多轮对话复用同一 Session，Anthropic 在容器里保持上下文）。
- **管理页 `/manage`**：编辑 Agent ID、显示名称、描述、开场白。
- **服务端 `/api/chat`**：使用 `client.beta.sessions.events.stream()` 接 SSE，stream-first 模式（先开 stream 再发消息），按 `session.status_idle && stop_reason !== requires_action` 或 `session.status_terminated` 优雅退出。

## 快速开始

```bash
pnpm install
cp .env.example .env.local
# 填入 ANTHROPIC_API_KEY，可选填 ANTHROPIC_ENVIRONMENT_ID
pnpm dev    # http://localhost:3000
```

## 架构

```
┌─ 浏览器 ─────────────┐     ┌─ Next.js 服务端 ──────────────┐     ┌─ Anthropic ─────────┐
│ Chat UI              │     │ /api/chat                     │     │ Managed Agents API   │
│  - LocalStorage:     │     │  - lazy-create environment    │     │                      │
│    AgentConfig       │ POST│  - sessions.create (首条消息) │ SDK │ agent_011Cab...      │
│    SessionId         │ ──▶ │  - events.stream (SSE)        │ ──▶ │ environment_xxx      │
│    Messages          │     │  - events.send (user.message) │     │ session_yyy          │
│                      │ SSE │  - 转发 agent.message 文本    │     │  └─ container        │
│                      │ ◀── │                               │ ◀── │     (tools execute)  │
└──────────────────────┘     └───────────────────────────────┘     └──────────────────────┘
```

**多轮对话**：Session 是有状态的，理小海会记住之前的对话上下文。前端把 `sessionId` 存在 LocalStorage，每次发消息一并带上。点击「新对话」即清空 sessionId 与本地消息，下条消息会创建新 Session。

## 关键 SDK 调用

```ts
// 创建 Session（多轮复用）
const session = await client.beta.sessions.create({
  agent: "agent_011CabNgA9MEKd3p63BmR566",
  environment_id: envId,
});

// stream-first：先开 stream，再发消息
const stream = await client.beta.sessions.events.stream(session.id);
await client.beta.sessions.events.send(session.id, {
  events: [{ type: "user.message", content: [{ type: "text", text: "..." }] }],
});

for await (const event of stream) {
  if (event.type === "agent.message") { /* 输出 text 块 */ }
  if (event.type === "session.status_terminated") break;
  if (event.type === "session.status_idle"
      && event.stop_reason?.type !== "requires_action") break;
}
```

## 目录

```
src/
  app/
    api/chat/route.ts   # 服务端 SSE 桥接 Anthropic Sessions API
    manage/page.tsx     # Agent ID + 显示信息配置
    page.tsx            # 对话页（多轮 Session）
    layout.tsx
    globals.css
  components/
    MessageBubble.tsx
  lib/
    agent.ts            # AgentConfig 默认值与 LocalStorage
```

## 注意

- 本前端不持有也不暴露 `ANTHROPIC_API_KEY`，所有 Anthropic API 调用都在 Next.js 服务端发起。
- Agent 的模型、System Prompt、Skills、MCP 工具等行为都在 Anthropic Console 端定义，调整这些请到 Console，不在本前端。
- 默认开发环境会在首次请求时创建一个 `lixiaohai-<timestamp>` 的 Cloud Environment。生产部署请把 `ANTHROPIC_ENVIRONMENT_ID` 写到环境变量，避免重启后产生新 Environment。
