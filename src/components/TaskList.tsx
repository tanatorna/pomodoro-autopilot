"use client";

import type { Task } from "@/generated/prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TaskListProps {
  tasks: Task[];
  currentTaskId: number | null;
  onSelect: (taskId: number) => void;
}

export function TaskList({ tasks, currentTaskId, onSelect }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <p className="text-zinc-500 text-sm text-center py-8">
        ยังไม่มี task — พิมพ์ด้านบนเพื่อเพิ่ม 👆
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2 w-full">
      {tasks.map((task) => {
        const isActive = task.id === currentTaskId;
        return (
          <li
            key={task.id}
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border transition-colors
              ${isActive
                ? "bg-amber-500/10 border-amber-500/40"
                : "bg-zinc-800/60 border-zinc-700/50 hover:border-zinc-600"
              }`}
          >
            {/* Task info */}
            <div className="flex items-center gap-3 min-w-0">
              {isActive && (
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
              )}
              <span
                className={`text-sm truncate ${
                  task.status === "done" ? "line-through text-zinc-500" : "text-zinc-200"
                }`}
              >
                {task.title}
              </span>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant="outline"
                className="border-zinc-600 text-zinc-400 text-xs"
              >
                {task.completedPomodoros}/{task.estimatedPomodoros} 🍅
              </Badge>
              {!isActive && task.status !== "done" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onSelect(task.id)}
                  className="text-xs text-zinc-400 hover:text-amber-400 h-7 px-2"
                >
                  เลือก
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
