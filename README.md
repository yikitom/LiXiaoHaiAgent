# 李小海 Agent 控制台

一个用于**管理**与**对话**李小海 Agent 的极简前端，使用 Next.js 15 + Tailwind 构建，后端通过 Anthropic Claude API 流式返回回复。

## 功能

- **对话页** `/`：与李小海实时流式对话，支持中断、清空、保存到 LocalStorage。
- **管理页** `/manage`：配置 Agent 的名称、人设描述、开场白、系统提示词、模型、`temperature`、`max_tokens`。
- **服务端 API** `POST /api/chat`：转发到 Anthropic SDK 并以 SSE 流式回包，API Key 不会暴露给前端。

## 快速开始

```bash
pnpm install        # 或 npm install
cp .env.example .env.local
# 在 .env.local 中填入 ANTHROPIC_API_KEY
pnpm dev            # http://localhost:3000
```

## 模型

默认使用 `claude-opus-4-7`，可在管理页中切换：

| 模型 ID | 适用场景 |
| --- | --- |
| `claude-opus-4-7` | 最强能力 |
| `claude-sonnet-4-6` | 速度与能力平衡 |
| `claude-haiku-4-5-20251001` | 极速、低成本 |

## 目录

```
src/
  app/
    api/chat/route.ts   # 服务端 SSE 流式 API
    manage/page.tsx     # Agent 配置页
    page.tsx            # 对话页
    layout.tsx
    globals.css
  components/
    MessageBubble.tsx
  lib/
    agent.ts            # AgentConfig 默认值与持久化
```

## 注意

- Agent 配置与对话历史保存在浏览器 LocalStorage，不会上传服务器。
- 系统提示词会以 `system` 字段直接传递给 Claude。
