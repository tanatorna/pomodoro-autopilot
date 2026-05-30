// POST /api/interrupt
// Interrupt flow (แยกออกจาก pause):
//   1. Void current ScheduleSlot (ลูกที่กำลังทำ)
//   2. สร้าง urgent task ด้วย priority สูงสุด + 10
//   3. Reset session → IDLE
//   4. Regenerate schedule (urgent task จะขึ้นบนสุด)
//   5. Auto-start timer ด้วย urgent task ทันที

import { prisma } from "@/lib/prisma";
import { generateSchedule } from "@/engine/scheduler";
import { start } from "@/engine/transitions";
import { INITIAL_STATE } from "@/engine/types";
import { timerStateToDb, dbToTimerState } from "@/lib/sessionMapper";

export async function POST(request: Request) {
  const body = (await request.json()) as { title?: string };

  if (!body.title?.trim()) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  const nowMs = Date.now();

  // ── 1. Void current slot ─────────────────────────────
  // หา slot ที่ pending อยู่ลำดับแรกสุด (slot ที่กำลังทำ)
  const currentSlot = await prisma.scheduleSlot.findFirst({
    where: { status: "pending" },
    orderBy: { slotIndex: "asc" },
  });

  if (currentSlot) {
    await prisma.scheduleSlot.update({
      where: { id: currentSlot.id },
      data: { status: "voided" },
    });
  }

  // ── 2. สร้าง urgent task ────────────────────────────
  // priority = max priority ปัจจุบัน + 10 → ขึ้นบนสุดเสมอ
  const maxPriorityTask = await prisma.task.findFirst({
    orderBy: { priority: "desc" },
  });
  const urgentPriority = (maxPriorityTask?.priority ?? 0) + 10;

  const urgentTask = await prisma.task.create({
    data: {
      title: body.title.trim(),
      priority: urgentPriority,
      estimatedPomodoros: 1,
      status: "in-progress",
    },
  });

  // ── 3. Reset session → IDLE ─────────────────────────
  const session = await prisma.session.findFirst({
    orderBy: { createdAt: "desc" },
  });

  // ── 4. Regenerate schedule ──────────────────────────
  // ดึง tasks ที่ยังต้องทำ (urgent task จะขึ้นบนสุดเพราะ priority สูงสุด)
  const tasks = await prisma.task.findMany({
    where: { status: { in: ["pending", "in-progress"] } },
  });

  const generated = generateSchedule(tasks);

  await prisma.scheduleSlot.deleteMany({ where: { status: "pending" } });

  if (generated.length > 0) {
    await prisma.scheduleSlot.createMany({ data: generated });
  }

  // ── 5. Auto-start ด้วย urgent task ─────────────────
  const idleState = { ...INITIAL_STATE };
  const workState = start(idleState, nowMs, urgentTask.id);

  let updatedSession;
  if (session) {
    updatedSession = await prisma.session.update({
      where: { id: session.id },
      data: timerStateToDb(workState),
    });
  } else {
    updatedSession = await prisma.session.create({
      data: timerStateToDb(workState),
    });
  }

  return Response.json({
    session: dbToTimerState(updatedSession),
    urgentTask,
  });
}
