"use client";

import type { Task } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TaskForm } from "./TaskForm";

interface BacklogViewProps {
  tasks: Task[];
  onAdd: (title: string, estimatedPomodoros: number) => Promise<void>;
  onMoveToActive: (taskId: number) => Promise<void>;
}

export function BacklogView({ tasks, onAdd, onMoveToActive }: BacklogViewProps) {
  return (
    <div className="flex flex-col gap-4">

      {/* Brain dump ไว้ใน Backlog — park task ที่ยังไม่รู้ว่าเมื่อไหร่จะทำ */}
      <TaskForm
        placeholder="park task ไว้ก่อน..."
        submitLabel="park"
        onAdd={onAdd}
      />

      {/* Divider */}
      <div className="border-t border-zinc-800" />

      {/* Empty state */}
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <span className="text-3xl">📭</span>
          <p className="text-zinc-500 text-sm text-center">
            Backlog ว่างเปล่า
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-zinc-500">
            {tasks.length} task รอวันพรุ่งนี้
          </p>
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-800/40 border border-zinc-700/30"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300 truncate">{task.title}</p>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {task.completedPomodoros}/{task.estimatedPomodoros} 🍅
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-zinc-700 text-zinc-500 text-xs shrink-0"
                >
                  backlog
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onMoveToActive(task.id)}
                  className="text-xs text-zinc-400 hover:text-amber-400 h-7 px-2 shrink-0"
                >
                  ใช้วันนี้
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
