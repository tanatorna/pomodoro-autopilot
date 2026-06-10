"use client";

import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import type { Task } from "@/generated/prisma/client";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { TaskForm } from "./TaskForm";

interface ScheduleMainProps {
  tasks: Task[];
  currentTaskId: number | null;
  pendingCount: number;
  onAdd: (title: string, estimatedPomodoros: number) => Promise<void>;
  onSelect: (taskId: number) => Promise<void>;
  onPriorityUp: (taskId: number) => Promise<void>;
  onPriorityDown: (taskId: number) => Promise<void>;
  /** ลากเรียงลำดับใหม่ทั้งชุด (id เรียงจากบน→ล่าง) */
  onReorder: (orderedIds: number[]) => Promise<void>;
  onEdit: (taskId: number, patch: { title?: string; estimatedPomodoros?: number }) => Promise<void>;
  /** ย้าย task ไป backlog (ไม่ทำวันนี้แล้ว) */
  onMoveToBacklog: (taskId: number) => Promise<void>;
  onDelete: (taskId: number) => Promise<void>;
  onEndDay: () => Promise<void>;
  endingDay: boolean;
  /** เก็บ task ที่เสร็จแล้วเข้าคลัง (หายจาก Schedule) */
  onClearDone: () => Promise<void>;
  clearing: boolean;
}

/** li ที่ลากได้ (dnd-kit sortable) — listeners ครอบทั้งการ์ด: กดค้าง(มือถือ)/กดลาก(เมาส์) แล้วเลื่อน */
function SortableRow({
  id,
  disabled,
  className,
  children,
}: {
  id: number;
  disabled: boolean;
  className: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 20 : undefined,
    position: isDragging ? "relative" : undefined,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`${className} ${disabled ? "" : "cursor-grab active:cursor-grabbing"}`}
      {...attributes}
      {...listeners}
    >
      {children}
    </li>
  );
}

export function ScheduleMain({
  tasks,
  currentTaskId,
  pendingCount,
  onAdd,
  onSelect,
  onPriorityUp,
  onPriorityDown,
  onReorder,
  onEdit,
  onMoveToBacklog,
  onDelete,
  onEndDay,
  endingDay,
  onClearDone,
  clearing,
}: ScheduleMainProps) {
  // done ลงท้าย → priority สูง→ต่ำ → id
  const sorted = [...tasks].sort((a, b) => {
    const ad = a.status === "done" ? 1 : 0;
    const bd = b.status === "done" ? 1 : 0;
    if (ad !== bd) return ad - bd;
    return b.priority !== a.priority ? b.priority - a.priority : a.id - b.id;
  });
  const activeTasks = sorted.filter((t) => t.status !== "done");
  const doneTasks = sorted.filter((t) => t.status === "done");

  // ยอด "สรุปวันนี้" = ผลรวม pomodoro ที่ task ทำเสร็จ (สะสมตลอดวัน · ไม่ใช่ตัวนับ cadence ของ session)
  const totalDonePomodoros = tasks.reduce((sum, t) => sum + t.completedPomodoros, 0);
  const tasksDone = tasks.filter((t) => t.status === "done").length;

  // ─── ลำดับ active (optimistic) — sync กับ props เมื่อ "ชุด id" เปลี่ยน (เพิ่ม/ลบ/เสร็จ) ───
  // ตอนลากเสร็จเรา setOrder ทันที + PATCH เบื้องหลัง · props กลับมาด้วย id เดิม (priority ใหม่)
  // → key เท่าเดิม → effect ไม่รีเซ็ต → ไม่กระตุก
  const activeIds = activeTasks.map((t) => t.id);
  const activeIdsKey = activeIds.join(",");
  const [order, setOrder] = useState<number[]>(activeIds);
  useEffect(() => {
    setOrder(activeTasks.map((t) => t.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdsKey]);

  const orderedActive: Task[] = order
    .map((id) => activeTasks.find((t) => t.id === id))
    .filter((t): t is Task => !!t);
  // กัน task ใหม่ที่ยังไม่เข้า order (ก่อน effect รัน) หาย
  for (const t of activeTasks) if (!order.includes(t.id)) orderedActive.push(t);

  const sensors = useSensors(
    // เมาส์: ลากเมื่อขยับ ≥8px (คลิกปุ่มปกติไม่ทริกเกอร์)
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    // สัมผัส: กดค้าง 220ms ค่อยลาก (ปัดเร็ว = scroll ตามปกติ ไม่โดนแย่ง)
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(active.id as number);
    const newIndex = order.indexOf(over.id as number);
    if (oldIndex < 0 || newIndex < 0) return;
    const newOrder = arrayMove(order, oldIndex, newIndex);
    setOrder(newOrder); // optimistic
    void onReorder(newOrder);
  }

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

  const liClass = (task: Task) =>
    `flex flex-col gap-2 px-3 py-2.5 rounded-xl border transition-colors group ${
      task.id === currentTaskId
        ? "bg-accent border-[var(--border-active)]"
        : "bg-card border-border hover:bg-secondary"
    }`;

  /** เนื้อในของแต่ละ row (ใช้ทั้ง active ที่ลากได้ + done ที่นิ่ง) · displayIndex<0 = done */
  function renderRow(task: Task, displayIndex: number): ReactNode {
    const isActive = task.id === currentTaskId;
    const isDone = task.status === "done";
    const isEditing = editingId === task.id;

    return (
      <>
        {/* Row 1: rank + dot + title (wrap) + pomodoro pill */}
        <div className="flex items-start gap-2">
          <span
            className="text-xs font-mono w-4 shrink-0 text-right pt-0.5 leading-snug"
            style={{ color: isDone ? "var(--success)" : "var(--faint)" }}
          >
            {isDone ? "✓" : displayIndex + 1}
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

        {/* Row 2: priority + start + edit/delete (ชิดขวา) */}
        {!isEditing && (
          // กดปุ่มแถวนี้ไม่ให้ทริกเกอร์ drag (stopPropagation กัน sensor activate)
          <div
            className="flex items-center justify-end gap-1 pl-6"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {!isDone && (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => onPriorityUp(task.id)}
                  className="text-[var(--faint)] hover:text-primary text-xs w-5 h-5 flex items-center justify-center leading-none rounded hover:bg-secondary"
                  title="เลื่อนขึ้น 1"
                >
                  ▲
                </button>
                <button
                  onClick={() => onPriorityDown(task.id)}
                  className="text-[var(--faint)] hover:text-foreground text-xs w-5 h-5 flex items-center justify-center leading-none rounded hover:bg-secondary"
                  title="เลื่อนลง 1"
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
            {!isActive && !isDone && (
              <button
                onClick={() => onMoveToBacklog(task.id)}
                className="text-[var(--faint)] hover:text-foreground text-xs w-6 h-6 flex items-center justify-center rounded hover:bg-secondary"
                title="ยังไม่ทำวันนี้ — ย้ายไป Backlog"
              >
                📥
              </button>
            )}
            {(!isActive || isDone) && (
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
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Add task */}
      <TaskForm placeholder="เพิ่ม task วันนี้..." onAdd={onAdd} />

      {/* Task list */}
      {sorted.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-10 text-center">
          <span className="text-3xl opacity-60">🗒️</span>
          <p className="text-[var(--ink-soft)] text-sm max-w-[220px]">
            ยังไม่มี task วันนี้ — พิมพ์ด้านบนเพื่อ brain dump…
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 flex-1 overflow-y-auto">
          {/* active = ลากเรียงได้ */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          >
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
              {orderedActive.map((task, index) => (
                <SortableRow
                  key={task.id}
                  id={task.id}
                  disabled={editingId === task.id}
                  className={liClass(task)}
                >
                  {renderRow(task, index)}
                </SortableRow>
              ))}
            </SortableContext>
          </DndContext>

          {/* done = นิ่ง ไม่ลาก */}
          {doneTasks.map((task) => (
            <li key={task.id} className={liClass(task)}>
              {renderRow(task, -1)}
            </li>
          ))}
        </ul>
      )}

      {/* Day summary */}
      {(sorted.length > 0 || totalDonePomodoros > 0) && (
        <div className="border border-border rounded-2xl p-3 bg-card flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">🌙 สรุปวันนี้</span>
            <div className="flex gap-3 text-xs">
              <span className="text-primary font-semibold">{totalDonePomodoros} 🍅</span>
              <span style={{ color: "var(--success)" }}>✓ {tasksDone} task</span>
              <span className="text-muted-foreground">{pendingCount} ค้าง</span>
            </div>
          </div>

          {pendingCount === 0 && totalDonePomodoros > 0 && (
            <p className="text-xs text-center" style={{ color: "var(--success)" }}>
              ✅ เคลียร์ทุก task วันนี้แล้ว!
            </p>
          )}

          {pendingCount > 0 && (
            <button
              onClick={onEndDay}
              disabled={endingDay}
              className="w-full rounded-lg bg-secondary border border-border text-[var(--ink-soft)] text-xs font-medium py-2 hover:bg-muted transition-colors disabled:opacity-50"
            >
              {endingDay ? "กำลังจัดการ..." : "🌙 จบวัน → ย้ายที่เหลือไป Backlog"}
            </button>
          )}

          {tasksDone > 0 && (
            <button
              onClick={onClearDone}
              disabled={clearing}
              className="w-full rounded-lg bg-secondary border border-border text-[var(--ink-soft)] text-xs font-medium py-2 hover:bg-muted transition-colors disabled:opacity-50"
            >
              {clearing ? "กำลังเก็บ..." : `🧹 เก็บ task ที่เสร็จเข้าคลัง (${tasksDone})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
