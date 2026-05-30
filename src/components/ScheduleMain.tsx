"use client";

import { useState } from "react";
import type { Task } from "@/generated/prisma/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ScheduleMainProps {
  tasks: Task[];
  currentTaskId: number | null;
  completedPomodoros: number;
  pendingCount: number;
  onAdd: (title: string) => Promise<void>;
  onSelect: (taskId: number) => Promise<void>;
  onPriorityUp: (taskId: number, current: number) => Promise<void>;
  onPriorityDown: (taskId: number, current: number) => Promise<void>;
  onEndDay: () => Promise<void>;
  endingDay: boolean;
}

export function ScheduleMain({
  tasks,
  currentTaskId,
  completedPomodoros,
  pendingCount,
  onAdd,
  onSelect,
  onPriorityUp,
  onPriorityDown,
  onEndDay,
  endingDay,
}: ScheduleMainProps) {
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setAdding(true);
    await onAdd(input.trim());
    setInput("");
    setAdding(false);
  }

  // เรียงตาม priority สูง → ต่ำ, id น้อย → มาก
  const sorted = [...tasks].sort((a, b) =>
    b.priority !== a.priority ? b.priority - a.priority : a.id - b.id
  );

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* Brain dump input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="เพิ่ม task..."
          disabled={adding}
          className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-amber-500"
        />
        <Button
          type="submit"
          disabled={adding || !input.trim()}
          className="bg-amber-500 hover:bg-amber-400 text-black font-semibold shrink-0"
        >
          เพิ่ม
        </Button>
      </form>

      {/* Task list */}
      {sorted.length === 0 ? (
        <p className="text-zinc-500 text-sm text-center py-8">
          ยังไม่มี task — พิมพ์ด้านบนเพื่อเพิ่ม 👆
        </p>
      ) : (
        <ul className="flex flex-col gap-2 flex-1 overflow-y-auto">
          {sorted.map((task, index) => {
            const isActive = task.id === currentTaskId;
            const isDone = task.status === "done";

            return (
              <li
                key={task.id}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors
                  ${isActive
                    ? "bg-amber-500/10 border-amber-500/40"
                    : "bg-zinc-800/50 border-zinc-700/40 hover:border-zinc-600/60"
                  }`}
              >
                {/* Rank */}
                <span className="text-xs text-zinc-600 font-mono w-4 shrink-0 text-right">
                  {isDone ? "✓" : index + 1}
                </span>

                {/* Active dot */}
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />
                )}

                {/* Title */}
                <span className={`flex-1 text-sm truncate min-w-0
                  ${isDone ? "line-through text-zinc-600" : isActive ? "text-white" : "text-zinc-300"}`}
                >
                  {task.title}
                </span>

                {/* Pomodoro count */}
                <Badge
                  variant="outline"
                  className="border-zinc-700 text-zinc-500 text-xs shrink-0 px-1.5"
                >
                  {task.completedPomodoros}/{task.estimatedPomodoros}🍅
                </Badge>

                {/* Priority controls */}
                {!isDone && (
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => onPriorityUp(task.id, task.priority)}
                      className="text-zinc-600 hover:text-amber-400 text-xs w-4 h-3.5 flex items-center justify-center leading-none"
                      title="เพิ่ม priority"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => onPriorityDown(task.id, task.priority)}
                      className="text-zinc-600 hover:text-zinc-400 text-xs w-4 h-3.5 flex items-center justify-center leading-none"
                      title="ลด priority"
                    >
                      ▼
                    </button>
                  </div>
                )}

                {/* Select button */}
                {!isActive && !isDone && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onSelect(task.id)}
                    className="text-xs text-zinc-500 hover:text-amber-400 h-6 px-1.5 shrink-0"
                  >
                    เลือก
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Day summary */}
      {(sorted.length > 0 || completedPomodoros > 0) && (
        <div className="border border-zinc-800 rounded-xl p-3 bg-zinc-800/20 flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">🌙 สรุปวันนี้</span>
            <div className="flex gap-3 text-xs">
              <span className="text-amber-400 font-mono font-semibold">
                {completedPomodoros} 🍅
              </span>
              <span className="text-zinc-500">
                {pendingCount} task ค้าง
              </span>
            </div>
          </div>

          {pendingCount > 0 && (
            <Button
              onClick={onEndDay}
              disabled={endingDay}
              size="sm"
              className="w-full bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs font-medium h-7"
            >
              {endingDay ? "กำลังจัดการ..." : "🌙 จบวัน → ย้ายที่เหลือไป Backlog"}
            </Button>
          )}

          {pendingCount === 0 && completedPomodoros > 0 && (
            <p className="text-xs text-emerald-500 text-center">
              ✅ เคลียร์ทุก task วันนี้แล้ว!
            </p>
          )}
        </div>
      )}
    </div>
  );
}
