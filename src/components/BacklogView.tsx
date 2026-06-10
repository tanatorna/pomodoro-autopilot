"use client";

import { useState } from "react";
import type { Task } from "@/generated/prisma/client";
import { TaskForm } from "./TaskForm";

interface BacklogViewProps {
  tasks: Task[];
  onAdd: (title: string, estimatedPomodoros: number) => Promise<void>;
  onMoveToActive: (taskId: number) => Promise<void>;
  /** ปักวันให้ task ใน backlog · null = เคลียร์วัน */
  onScheduleTask: (taskId: number, isoDate: string | null) => Promise<void>;
  /** แก้ชื่อ + จำนวน 🍅 (เหมือน Schedule) */
  onEdit: (taskId: number, patch: { title?: string; estimatedPomodoros?: number }) => Promise<void>;
  onDelete: (taskId: number) => Promise<void>;
}

/** วันนี้ใน ISO local YYYY-MM-DD — ใช้เป็น min ของ date input */
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** format DateTime → "ศ. 27 มิ.ย." */
function fmtThai(dt: Date): string {
  const days = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
  const months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return `${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]}`;
}

/** task → ISO yyyy-mm-dd (สำหรับ date input value) */
function taskToInputValue(t: Task): string {
  if (!t.scheduledFor) return "";
  const d = new Date(t.scheduledFor);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function BacklogView({ tasks, onAdd, onMoveToActive, onScheduleTask, onEdit, onDelete }: BacklogViewProps) {
  // ─── inline date picker state ───
  const [openPickerId, setOpenPickerId] = useState<number | null>(null);

  // ─── inline edit state (title + pomodoros) — เหมือน ScheduleMain ───
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editPomodoros, setEditPomodoros] = useState(1);

  function startEdit(task: Task) {
    setOpenPickerId(null);
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

  // แยก 2 กลุ่ม: มีกำหนดวัน (เรียงใกล้→ไกล) · ยังไม่กำหนด
  const scheduled = tasks
    .filter((t) => t.scheduledFor)
    .sort((a, b) => +new Date(a.scheduledFor!) - +new Date(b.scheduledFor!));
  const someday = tasks.filter((t) => !t.scheduledFor);

  function renderItem(task: Task) {
    const dt = task.scheduledFor ? new Date(task.scheduledFor) : null;
    const isPicking = openPickerId === task.id;
    const isEditing = editingId === task.id;

    return (
      <li
        key={task.id}
        className="flex flex-col gap-2 px-3 py-2.5 rounded-xl bg-card border border-border"
      >
        {/* Row 1: ชื่อ (หรือ input ตอน edit) + stepper 🍅 ตอน edit */}
        <div className="flex items-start gap-2">
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
            <p
              onDoubleClick={() => startEdit(task)}
              className="flex-1 text-sm text-[var(--ink-soft)] leading-snug break-words min-w-0"
              title={task.title}
            >
              {task.title}
            </p>
          )}

          {isEditing && (
            <div
              className="flex items-center gap-1 shrink-0 self-start"
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

        {!isEditing && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-[var(--faint)]">
            {task.completedPomodoros}/{task.estimatedPomodoros} 🍅
          </span>

          <div className="flex items-center gap-1">
            {/* Date chip / picker */}
            {isPicking ? (
              <input
                type="date"
                autoFocus
                min={todayISO()}
                defaultValue={taskToInputValue(task)}
                onChange={async (e) => {
                  await onScheduleTask(task.id, e.target.value || null);
                  setOpenPickerId(null);
                }}
                onBlur={() => setOpenPickerId(null)}
                className="text-xs bg-card border border-primary rounded-md px-2 py-1 text-foreground focus:outline-none"
              />
            ) : dt ? (
              <button
                onClick={() => setOpenPickerId(task.id)}
                className="text-xs font-medium text-primary hover:text-[var(--accent-hover)] px-2 h-7 rounded-md hover:bg-secondary"
                title="คลิกเพื่อแก้วัน"
              >
                📅 {fmtThai(dt)}
              </button>
            ) : (
              <button
                onClick={() => setOpenPickerId(task.id)}
                className="text-xs font-medium text-muted-foreground hover:text-primary px-2 h-7 rounded-md hover:bg-secondary"
              >
                📅 ปักวัน
              </button>
            )}

            {/* Clear (มี chip แล้วเท่านั้น) */}
            {dt && !isPicking && (
              <button
                onClick={() => onScheduleTask(task.id, null)}
                className="text-xs text-[var(--faint)] hover:text-[var(--danger)] w-6 h-7 flex items-center justify-center rounded hover:bg-secondary"
                title="เคลียร์วัน"
              >
                ✕
              </button>
            )}

            {/* ทำวันนี้ — promote ทันที */}
            <button
              onClick={() => onMoveToActive(task.id)}
              className="text-xs font-medium text-muted-foreground hover:text-primary h-7 px-2 rounded-md transition-colors"
            >
              ↑ ทำวันนี้
            </button>

            {/* แก้ไข + ลบ (เหมือน Schedule) */}
            <button
              onClick={() => startEdit(task)}
              className="text-[var(--faint)] hover:text-primary text-xs w-6 h-7 flex items-center justify-center rounded hover:bg-secondary"
              title="แก้ชื่อ / จำนวน 🍅"
            >
              ✎
            </button>
            <button
              onClick={() => onDelete(task.id)}
              className="text-[var(--faint)] hover:text-[var(--danger)] text-xs w-6 h-7 flex items-center justify-center rounded hover:bg-secondary"
              title="ลบ task"
            >
              🗑
            </button>
          </div>
        </div>
        )}
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <TaskForm
        placeholder="เก็บงานอนาคตเข้า backlog..."
        submitLabel="เก็บ"
        onAdd={onAdd}
      />

      <div className="border-t border-border" />

      {tasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-10 text-center">
          <span className="text-3xl opacity-60">📥</span>
          <p className="text-[var(--ink-soft)] text-sm max-w-[240px]">
            Backlog ว่าง — งานที่ค้างตอนจบวันจะมาอยู่ที่นี่
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {scheduled.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                📅 มีกำหนด · {scheduled.length}
              </h3>
              <ul className="flex flex-col gap-2">{scheduled.map(renderItem)}</ul>
            </section>
          )}
          {someday.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                🌙 ยังไม่กำหนด · {someday.length}
              </h3>
              <ul className="flex flex-col gap-2">{someday.map(renderItem)}</ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
