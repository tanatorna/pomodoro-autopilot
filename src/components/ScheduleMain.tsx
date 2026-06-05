"use client";

import { useState } from "react";
import type { Task } from "@/generated/prisma/client";

interface ScheduleMainProps {
  tasks: Task[];
  currentTaskId: number | null;
  completedPomodoros: number;
  pendingCount: number;
  onAdd: (title: string, estimatedPomodoros: number) => Promise<void>;
  onSelect: (taskId: number) => Promise<void>;
  onPriorityUp: (taskId: number, current: number) => Promise<void>;
  onPriorityDown: (taskId: number, current: number) => Promise<void>;
  onEdit: (taskId: number, patch: { title?: string; estimatedPomodoros?: number }) => Promise<void>;
  onDelete: (taskId: number) => Promise<void>;
  onEndDay: () => Promise<void>;
  endingDay: boolean;
}

import { TaskForm } from "./TaskForm";

export function ScheduleMain({
  tasks,
  currentTaskId,
  completedPomodoros,
  pendingCount,
  onAdd,
  onSelect,
  onPriorityUp,
  onPriorityDown,
  onEdit,
  onDelete,
  onEndDay,
  endingDay,
}: ScheduleMainProps) {
  // done ลงท้าย → priority สูง→ต่ำ → id
  const sorted = [...tasks].sort((a, b) => {
    const ad = a.status === "done" ? 1 : 0;
    const bd = b.status === "done" ? 1 : 0;
    if (ad !== bd) return ad - bd;
    return b.priority !== a.priority ? b.priority - a.priority : a.id - b.id;
  });

  // ─── inline edit state (title + pomodoros) ───
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editPomodoros, setEditPomodoros] = useState(1);

  function startEdit(task: Task) {
    setEditingId(task.id);
    setEditText(task.title);
    setEditPomodoros(task.estimatedPomodoros);
  }

  function commitEdit(task: Task) {
    if (editingId !== task.id) return;
    const nextTitle = editText.trim();
    const nextPom = editPomodoros;
    setEditingId(null);

    const patch: { title?: string; estimatedPomodoros?: number } = {};
    if (nextTitle && nextTitle !== task.title) patch.title = nextTitle;
    if (nextPom !== task.estimatedPomodoros && nextPom >= 1 && nextPom <= 12) {
      patch.estimatedPomodoros = nextPom;
    }
    if (Object.keys(patch).length) void onEdit(task.id, patch);
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Add task */}
      <TaskForm placeholder="เพิ่ม task วันนี้..." onAdd={onAdd} />

      {/* Task list */}
      {sorted.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-10 text-center">
          <span className="text-3xl opacity-60">🗒️</span>
          <p className="text-muted-foreground text-sm max-w-[220px]">
            ยังไม่มี task วันนี้ — พิมพ์ด้านบนเพื่อ brain dump…
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 flex-1 overflow-y-auto">
          {sorted.map((task, index) => {
            const isActive = task.id === currentTaskId;
            const isDone = task.status === "done";
            const isEditing = editingId === task.id;

            return (
              <li
                key={task.id}
                className={`flex flex-col gap-2 px-3 py-2.5 rounded-xl border transition-colors group
                  ${isActive
                    ? "bg-accent border-[var(--border-active)]"
                    : "bg-card border-border hover:bg-secondary"
                  }`}
              >
                {/* Row 1: rank + dot + title (wrap) + pomodoro pill */}
                <div className="flex items-start gap-2">
                  <span
                    className="text-xs font-mono w-4 shrink-0 text-right pt-0.5 leading-snug"
                    style={{ color: isDone ? "var(--success)" : "var(--faint)" }}
                  >
                    {isDone ? "✓" : index + 1}
                  </span>

                  {isActive && !isEditing && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 animate-pulse mt-2" />
                  )}

                  {isEditing ? (
                    <input
                      autoFocus
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onBlur={() => commitEdit(task)}
                      className="flex-1 min-w-0 text-sm bg-card border border-primary rounded-md px-2 py-1 text-foreground focus:outline-none"
                    />
                  ) : (
                    <span
                      onDoubleClick={() => !isDone && startEdit(task)}
                      title={task.title}
                      className={`flex-1 text-sm leading-snug break-words min-w-0
                        ${isDone
                          ? "line-through text-muted-foreground"
                          : isActive
                            ? "text-foreground font-semibold"
                            : "text-[var(--ink-soft)]"}`}
                    >
                      {task.title}
                    </span>
                  )}

                  {!isEditing ? (
                    <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-xs text-muted-foreground self-start mt-0.5">
                      {task.completedPomodoros}/{task.estimatedPomodoros}🍅
                    </span>
                  ) : (
                    // editing → แสดง stepper สำหรับแก้จำนวน 🍅 (เก็บค่าใน state ระหว่าง edit · commit ตอน blur title)
                    <div
                      className="flex items-center gap-1 shrink-0 self-start"
                      // กดในกลุ่ม stepper → คง focus ที่ input title ไม่ให้ blur ก่อนเวลา
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <button
                        type="button"
                        onClick={() => setEditPomodoros((p) => Math.max(1, p - 1))}
                        disabled={editPomodoros <= 1}
                        className="w-6 h-6 rounded-md bg-card border border-border text-[var(--ink-soft)] hover:bg-secondary disabled:opacity-30 text-xs flex items-center justify-center"
                      >
                        −
                      </button>
                      <span className="text-xs font-semibold text-primary w-9 text-center">
                        {editPomodoros}🍅
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditPomodoros((p) => Math.min(12, p + 1))}
                        disabled={editPomodoros >= 12}
                        className="w-6 h-6 rounded-md bg-card border border-border text-[var(--ink-soft)] hover:bg-secondary disabled:opacity-30 text-xs flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>

                {/* Row 2: priority + start + edit/delete (ชิดขวา) */}
                {!isEditing && (
                  <div className="flex items-center justify-end gap-1 pl-6">
                    {!isDone && (
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => onPriorityUp(task.id, task.priority)}
                          className="text-[var(--faint)] hover:text-primary text-xs w-5 h-5 flex items-center justify-center leading-none rounded hover:bg-secondary"
                          title="เพิ่ม priority"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => onPriorityDown(task.id, task.priority)}
                          className="text-[var(--faint)] hover:text-foreground text-xs w-5 h-5 flex items-center justify-center leading-none rounded hover:bg-secondary"
                          title="ลด priority"
                        >
                          ▼
                        </button>
                      </div>
                    )}

                    {!isActive && !isDone && (
                      <button
                        onClick={() => onSelect(task.id)}
                        className="text-xs font-medium text-muted-foreground hover:text-primary px-2 h-6 rounded-md transition-colors"
                      >
                        เริ่ม
                      </button>
                    )}

                    {!isDone && (
                      <button
                        onClick={() => startEdit(task)}
                        className="text-[var(--faint)] hover:text-primary text-xs w-6 h-6 flex items-center justify-center rounded hover:bg-secondary"
                        title="แก้ชื่อ"
                      >
                        ✎
                      </button>
                    )}
                    {!isActive && (
                      <button
                        onClick={() => onDelete(task.id)}
                        className="text-[var(--faint)] hover:text-[var(--danger)] text-xs w-6 h-6 flex items-center justify-center rounded hover:bg-secondary"
                        title="ลบ task"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Day summary */}
      {(sorted.length > 0 || completedPomodoros > 0) && (
        <div className="border border-border rounded-2xl p-3 bg-card flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">🌙 สรุปวันนี้</span>
            <div className="flex gap-3 text-xs">
              <span className="text-primary font-semibold">{completedPomodoros} 🍅</span>
              <span className="text-muted-foreground">{pendingCount} ค้าง</span>
            </div>
          </div>

          {pendingCount > 0 && (
            <button
              onClick={onEndDay}
              disabled={endingDay}
              className="w-full rounded-lg bg-secondary border border-border text-[var(--ink-soft)] text-xs font-medium py-2 hover:bg-muted transition-colors disabled:opacity-50"
            >
              {endingDay ? "กำลังจัดการ..." : "🌙 จบวัน → ย้ายที่เหลือไป Backlog"}
            </button>
          )}

          {pendingCount === 0 && completedPomodoros > 0 && (
            <p className="text-xs text-center" style={{ color: "var(--success)" }}>
              ✅ เคลียร์ทุก task วันนี้แล้ว!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
