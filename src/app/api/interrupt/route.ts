import { prisma } from "@/lib/prisma";
import { getRoomId } from "@/lib/room";
import { generateSchedule } from "@/engine/scheduler";
import { start } from "@/engine/transitions";
import { INITIAL_STATE } from "@/engine/types";
import { timerStateToDb, dbToTimerState } from "@/lib/sessionMapper";

export async function POST(request: Request) {
  const roomId = getRoomId(request);
  const body = (await request.json()) as { title?: string };

  if (!body.title?.trim()) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  const nowMs = Date.now();

  const currentSlot = await prisma.scheduleSlot.findFirst({
    where: { roomId, status: "pending" },
    orderBy: { slotIndex: "asc" },
  });

  if (currentSlot) {
    await prisma.scheduleSlot.update({
      where: { id: currentSlot.id },
      data: { status: "voided" },
    });
  }

  const maxPriorityTask = await prisma.task.findFirst({
    where: { roomId },
    orderBy: { priority: "desc" },
  });
  const urgentPriority = (maxPriorityTask?.priority ?? 0) + 10;

  const urgentTask = await prisma.task.create({
    data: {
      roomId,
      title: body.title.trim(),
      priority: urgentPriority,
      estimatedPomodoros: 1,
      status: "in-progress",
    },
  });

  const tasks = await prisma.task.findMany({
    where: { roomId, status: { in: ["pending", "in-progress"] } },
  });

  const generated = generateSchedule(tasks);

  await prisma.scheduleSlot.deleteMany({ where: { roomId, status: "pending" } });

  if (generated.length > 0) {
    await prisma.scheduleSlot.createMany({
      data: generated.map((s) => ({ ...s, roomId })),
    });
  }

  const session = await prisma.session.findFirst({
    where: { roomId },
    orderBy: { createdAt: "desc" },
  });

  const workState = start({ ...INITIAL_STATE }, nowMs, urgentTask.id);

  let updatedSession;
  if (session) {
    updatedSession = await prisma.session.update({
      where: { id: session.id },
      data: timerStateToDb(workState),
    });
  } else {
    updatedSession = await prisma.session.create({
      data: { ...timerStateToDb(workState), roomId },
    });
  }

  return Response.json({
    session: dbToTimerState(updatedSession),
    urgentTask,
  });
}
