"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import { Card, CardHeader, PageHeader, Pill, Stat } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import Modal from "@/components/ui/Modal";
import { MemoryEntry, loadMemory, saveMemory } from "@/lib/memory";

export default function MemoryPage() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<MemoryEntry | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setEntries(loadMemory());
  }, []);

  const persist = (next: MemoryEntry[]) => {
    setEntries(next);
    saveMemory(next);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.path.toLowerCase().includes(q) ||
        e.preview.toLowerCase().includes(q),
    );
  }, [entries, query]);

  const totalBytes = entries.reduce((sum, e) => sum + e.size, 0);
  const lastUpdate = entries
    .map((e) => e.updatedAt)
    .sort()
    .pop();

  const groups = useMemo(() => {
    const map = new Map<string, MemoryEntry[]>();
    for (const e of filtered) {
      const top = "/" + e.path.split("/").filter(Boolean)[0];
      if (!map.has(top)) map.set(top, []);
      map.get(top)!.push(e);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const removeEntry = (id: string) => {
    if (!confirm("从记忆中删除该条目？")) return;
    persist(entries.filter((e) => e.id !== id));
    if (viewing?.id === id) setViewing(null);
  };

  const clearAll = () => {
    if (!confirm("清空所有记忆？理小海将丢失全部跨会话沉淀，操作不可撤销。"))
      return;
    persist([]);
  };

  const addManual = (path: string, content: string) => {
    const next: MemoryEntry = {
      id: `m-${Date.now()}`,
      path: path.startsWith("/") ? path : `/${path}`,
      size: new TextEncoder().encode(content).length,
      updatedAt: new Date().toISOString(),
      preview: content.slice(0, 200),
      source: "manual",
    };
    persist([next, ...entries]);
    setAdding(false);
  };

  return (
    <div>
      <PageHeader
        title="记忆"
        description="理小海的跨会话记忆。任何时候都可以查看、搜索、修订或删除。重要事实会在每轮对话开始时被自动注入上下文。"
        trailing={
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={clearAll}
              disabled={entries.length === 0}
            >
              清空记忆
            </Button>
            <Button onClick={() => setAdding(true)}>手工新增</Button>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="条目数" value={entries.length} />
        <Stat
          label="总大小"
          value={`${(totalBytes / 1024).toFixed(1)} KB`}
          hint="本地浏览器估算"
        />
        <Stat
          label="最近更新"
          value={
            lastUpdate
              ? new Date(lastUpdate).toLocaleDateString("zh-CN")
              : "—"
          }
        />
      </div>

      <Card className="mb-4 p-4">
        <Input
          placeholder="按路径或内容搜索…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </Card>

      {groups.length === 0 && (
        <Card className="text-center">
          <p className="text-[13px] text-slate-500">
            没有匹配的记忆条目。
          </p>
        </Card>
      )}

      <div className="space-y-5">
        {groups.map(([prefix, group]) => (
          <ListGroup key={prefix} title={prefix}>
            {group.map((e) => (
              <ListRow
                key={e.id}
                onClick={() => setViewing(e)}
                primary={
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[13px]">{e.path}</span>
                    <SourcePill source={e.source} />
                  </span>
                }
                secondary={e.preview}
                trailing={
                  <span className="text-[12px]">
                    {new Date(e.updatedAt).toLocaleDateString("zh-CN")}
                    {" · "}
                    {(e.size / 1024).toFixed(1)} KB
                  </span>
                }
              />
            ))}
          </ListGroup>
        ))}
      </div>

      <p className="mt-4 text-[12px] text-slate-500 dark:text-slate-400">
        生产部署时建议把记忆存到 Anthropic Memory Stores（持久化在 Anthropic
        平台），避免本地浏览器丢失。
      </p>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.path}
        description={
          viewing
            ? `更新于 ${new Date(viewing.updatedAt).toLocaleString("zh-CN")} · ${(viewing.size / 1024).toFixed(1)} KB`
            : ""
        }
        size="md"
        footer={
          viewing && (
            <>
              <Button variant="secondary" onClick={() => setViewing(null)}>
                关闭
              </Button>
              <Button
                variant="destructive"
                onClick={() => removeEntry(viewing.id)}
              >
                删除条目
              </Button>
            </>
          )
        }
      >
        {viewing && (
          <pre className="whitespace-pre-wrap break-words rounded-lg bg-slate-100 p-3 font-mono text-[12px] leading-relaxed dark:bg-slate-800">
            {viewing.preview}
          </pre>
        )}
      </Modal>

      <AddMemoryModal
        open={adding}
        onClose={() => setAdding(false)}
        onAdd={addManual}
      />
    </div>
  );
}

function SourcePill({ source }: { source: MemoryEntry["source"] }) {
  if (source === "seeded") return <Pill tone="indigo">初始</Pill>;
  if (source === "conversation") return <Pill tone="blue">对话沉淀</Pill>;
  return <Pill tone="neutral">手工</Pill>;
}

function AddMemoryModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (path: string, content: string) => void;
}) {
  const [path, setPath] = useState("/preferences/");
  const [content, setContent] = useState("");

  return (
    <Modal
      open={open}
      onClose={() => {
        setPath("/preferences/");
        setContent("");
        onClose();
      }}
      title="手工新增记忆"
      description="把一段事实或偏好显式写入理小海的记忆。下次对话开始时会自动注入。"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={() => onAdd(path.trim(), content.trim())}
            disabled={!path.trim() || !content.trim()}
          >
            写入
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="路径">
          <Input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/preferences/cash-management.md"
          />
        </Field>
        <Field label="内容">
          <Textarea
            rows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="例如：在新加坡有 80 万新币流动资金，需保持随时可取的现金管理工具。"
          />
        </Field>
      </div>
    </Modal>
  );
}
