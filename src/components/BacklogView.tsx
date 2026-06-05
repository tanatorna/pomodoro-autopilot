"use client";

import type { Task } from "@/generated/prisma/client";
import { TaskForm } from "./TaskForm";

interface BacklogViewProps {
  tasks: Task[];
  onAdd: (title: string, estimatedPomodoros: number) => Promise<void>;
  onMoveToActive: (taskId: number) => Promise<void>;
}

export function BacklogView({ tasks, onAdd, onMoveToActive }: BacklogViewProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* park task ที่ยังไม่รู้ว่าเมื่อไหร่จะทำ */}
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
        <>
          <p className="text-xs text-muted-foreground">
            {tasks.length} task รอวันพรุ่งนี้
          </p>
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-card border border-border"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--ink-soft)] truncate">{task.title}</p>
                  <p className="text-xs text-[var(--faint)] mt-0.5">
                    {task.completedPomodoros}/{task.estimatedPomodoros} 🍅
                  </p>
                </div>
                <button
                  onClick={() => onMoveToActive(task.id)}
                  className="text-xs font-medium text-muted-foreground hover:text-primary h-7 px-2 shrink-0 rounded-md transition-colors"
                >
                  ↑ ทำวันนี้
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
