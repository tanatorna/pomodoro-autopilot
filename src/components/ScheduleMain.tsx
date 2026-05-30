"use client";

import { useState } from "react";
import type { Task } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TaskForm } from "./TaskForm";

interface ScheduleMainProps {
  tasks: Task[];
  currentTaskId: number | null;
  completedPomodoros: number;
  pendingCount: number;
  onAdd: (title: string, estimatedPomodoros: number) => Promise<void>;
  onSelect: (taskId: number) => Promise<void>;
  onPriorityUp: (taskId: number, current: number) => Promise<void>;
  onPriorityDown: (taskId: number, current: number) => Promise<void>;
  onEdit: (taskId: number, title: string) => Promise<void>;
  onDelete: (taskId: number) => Promise<void>;
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
  onEdit,
  onDelete,
  onEndDay,
  endingDay,
}: ScheduleMainProps) {
  // เรียงตาม priority สูง → ต่ำ, id น้อย → มาก
  const sorted = [...tasks].sort((a, b) =>
    b.priority !== a.priority ? b.priority - a.priority : a.id - b.id
  );

  // ─── inline edit state ───
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  function startEdit(task: Task) {
    setEditingId(task.id);
    setEditText(task.title);
  }

  /** บันทึกการแก้ไข — เรียกตอน blur; Escape จะ set editingId=null ก่อนจึงไม่บันทึก */
  function commitEdit(taskId: number, original: string) {
    if (editingId !== taskId) return; // ถูกยกเลิก (Escape) ไปแล้ว
    const next = editText.trim();
    setEditingId(null);
    if (next && next !== original) void onEdit(taskId, next);
  }

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* Brain dump input — task ที่จะทำวันนี้ */}
      <TaskForm
        placeholder="เพิ่ม task วันนี้..."
        onAdd={onAdd}
      />

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
            const isEditing = editingId === task.id;

            return (
              <li
                key={task.id}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-colors group
                  ${isActive
                    ? "bg-amber-400/15 border-amber-300/40"
                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                  }`}
              >
                {/* Rank */}
                <span className="text-xs text-zinc-600 font-mono w-4 shrink-0 text-right">
                  {isDone ? "✓" : index + 1}
                </span>

                {/* Active dot */}
                {isActive && !isEditing && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />
                )}

                {/* Title — แก้ไขแบบ inline ได้ */}
                {isEditing ? (
                  <input
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur(); // → trigger onBlur commit
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => commitEdit(task.id, task.title)}
                    className="flex-1 min-w-0 text-sm bg-zinc-900 border border-amber-500/50 rounded px-2 py-1 text-white focus:outline-none"
                  />
                ) : (
                  <span
                    onDoubleClick={() => !isDone && startEdit(task)}
                    title={isDone ? undefined : "ดับเบิลคลิกเพื่อแก้ชื่อ"}
                    className={`flex-1 text-sm truncate min-w-0
                      ${isDone ? "line-through text-zinc-600" : isActive ? "text-white" : "text-zinc-300"}`}
                  >
                    {task.title}
                  </span>
                )}

                {!isEditing && (
                  <>
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

                    {/* Edit + Delete — โผล่ตอน hover */}
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!isDone && (
                        <button
                          onClick={() => startEdit(task)}
                          className="text-zinc-600 hover:text-amber-400 text-xs w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-700/50"
                          title="แก้ชื่อ"
                        >
                          ✎
                        </button>
                      )}
                      {/* ห้ามลบ task ที่กำลังโฟกัสอยู่ (กันลบพลาดระหว่างจับเวลา) */}
                      {!isActive && (
                        <button
                          onClick={() => onDelete(task.id)}
                          className="text-zinc-600 hover:text-red-400 text-xs w-5 h-5 flex items-center justify-center rounded hover:bg-zinc-700/50"
                          title="ลบ task"
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </>
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
