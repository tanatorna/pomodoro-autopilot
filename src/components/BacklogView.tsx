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

export function BacklogView({ tasks, onAdd, onMoveToActive, onScheduleTask }: BacklogViewProps) {
  // ─── inline date picker state ───
  const [openPickerId, setOpenPickerId] = useState<number | null>(null);

  // แยก 2 กลุ่ม: มีกำหนดวัน (เรียงใกล้→ไกล) · ยังไม่กำหนด
  const scheduled = tasks
    .filter((t) => t.scheduledFor)
    .sort((a, b) => +new Date(a.scheduledFor!) - +new Date(b.scheduledFor!));
  const someday = tasks.filter((t) => !t.scheduledFor);

  function renderItem(task: Task) {
    const dt = task.scheduledFor ? new Date(task.scheduledFor) : null;
    const isPicking = openPickerId === task.id;

    return (
      <li
        key={task.id}
        className="flex flex-col gap-2 px-3 py-2.5 rounded-xl bg-card border border-border"
      >
        <p className="text-sm text-[var(--ink-soft)] leading-snug break-words" title={task.title}>
          {task.title}
        </p>

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
          </div>
        </div>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <TaskForm
        placeholder="เก็บงานอนาคตเข้า backlog..."
        submitLabel="เก็บ"
        onAdd={onAdd}
      />

      <div className="border-t border-border" />

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
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
