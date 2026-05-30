"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Task } from "@/generated/prisma/client";

interface SlotWithTask {
  id: number;
  slotIndex: number;
  status: string;
  task: Task;
}

interface ScheduleViewProps {
  slots: SlotWithTask[];
  currentTaskId: number | null;
  onGenerate: () => Promise<void>;
  onPriorityUp: (taskId: number, currentPriority: number) => Promise<void>;
  onPriorityDown: (taskId: number, currentPriority: number) => Promise<void>;
  generating: boolean;
}

export function ScheduleView({
  slots,
  currentTaskId,
  onGenerate,
  onPriorityUp,
  onPriorityDown,
  generating,
}: ScheduleViewProps) {
  // จัดกลุ่ม slots ตาม task
  const taskOrder: number[] = [];
  const taskSlotCount: Record<number, number> = {};

  for (const slot of slots) {
    if (!taskOrder.includes(slot.task.id)) taskOrder.push(slot.task.id);
    taskSlotCount[slot.task.id] = (taskSlotCount[slot.task.id] ?? 0) + 1;
  }

  const taskMap: Record<number, Task> = {};
  for (const slot of slots) taskMap[slot.task.id] = slot.task;

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Header + Generate button */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
          Schedule วันนี้
        </h2>
        <Button
          size="sm"
          onClick={onGenerate}
          disabled={generating}
          className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold h-7 px-3"
        >
          {generating ? "กำลังจัด..." : "⚡ จัด Schedule"}
        </Button>
      </div>

      {/* Empty state */}
      {taskOrder.length === 0 && (
        <p className="text-zinc-500 text-sm text-center py-6">
          กด "จัด Schedule" เพื่อให้ระบบจัด Pomodoro ให้อัตโนมัติ
        </p>
      )}

      {/* Schedule list */}
      <ul className="flex flex-col gap-2">
        {taskOrder.map((taskId, index) => {
          const task = taskMap[taskId];
          if (!task) return null;
          const isActive = taskId === currentTaskId;
          const slotCount = taskSlotCount[taskId] ?? 0;

          return (
            <li
              key={taskId}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors
                ${isActive
                  ? "bg-amber-500/10 border-amber-500/40"
                  : "bg-zinc-800/50 border-zinc-700/40"
                }`}
            >
              {/* Slot number */}
              <span className="text-xs text-zinc-600 font-mono w-5 shrink-0">
                {index + 1}
              </span>

              {/* Task title */}
              <span className="flex-1 text-sm text-zinc-200 truncate">
                {isActive && (
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-2 animate-pulse" />
                )}
                {task.title}
              </span>

              {/* Pomodoro count */}
              <Badge
                variant="outline"
                className="border-zinc-700 text-zinc-500 text-xs shrink-0"
              >
                {"🍅".repeat(Math.min(slotCount, 6))} {slotCount > 6 ? `+${slotCount - 6}` : ""}
              </Badge>

              {/* Priority controls */}
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => onPriorityUp(task.id, task.priority)}
                  className="text-zinc-600 hover:text-zinc-300 text-xs w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-700"
                  title="เพิ่ม priority"
                >
                  ▲
                </button>
                <button
                  onClick={() => onPriorityDown(task.id, task.priority)}
                  className="text-zinc-600 hover:text-zinc-300 text-xs w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-700"
                  title="ลด priority"
                >
                  ▼
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Summary */}
      {slots.length > 0 && (
        <p className="text-xs text-zinc-600 text-right">
          {slots.length} Pomodoro · {Math.round((slots.length * 30) / 60)} ชั่วโมง
        </p>
      )}
    </div>
  );
}
