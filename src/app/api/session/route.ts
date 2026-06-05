import { prisma } from "@/lib/prisma";
import { getRoomId } from "@/lib/room";
import { dbToTimerState, timerStateToDb } from "@/lib/sessionMapper";
import { start, pause, resume, restart, tick, type DurationConfig } from "@/engine/transitions";
import { DURATIONS, INITIAL_STATE, type TimerState } from "@/engine/types";

/** void current pending slot (ลูกที่กำลังทำ) — ใช้กับ switch/skip */
async function voidCurrentSlot(roomId: string) {
  const slot = await prisma.scheduleSlot.findFirst({
    where: { roomId, status: "pending" },
    orderBy: { slotIndex: "asc" },
  });
  if (slot) {
    await prisma.scheduleSlot.update({
      where: { id: slot.id },
      data: { status: "voided" },
    });
  }
}

/** สร้าง state WORK ใหม่ผูกกับ taskId (ใช้ตอน switch / skip) */
function workWith(current: TimerState, nowMs: number, taskId: number | null, custom?: Partial<DurationConfig>): TimerState {
  const workMs = custom?.WORK ?? DURATIONS.WORK;
  return {
    state: "WORK",
    endsAt: nowMs + workMs,
    remainingMs: null,
    origin: null,
    completedPomodoros: current.completedPomodoros,
    currentTaskId: taskId,
  };
}

async function getOrCreateSession(roomId: string) {
  const existing = await prisma.session.findFirst({
    where: { roomId },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;
  return prisma.session.create({ data: { roomId, ...timerStateToDb(INITIAL_STATE) } });
}

export async function GET(request: Request) {
  const roomId = getRoomId(request);
  const session = await getOrCreateSession(roomId);
  return Response.json(dbToTimerState(session));
}

type SessionAction =
  | { action: "start"; taskId?: number; durations?: Partial<DurationConfig> }
  | { action: "pause" }
  | { action: "resume" }
  | { action: "restart"; durations?: Partial<DurationConfig> }
  | { action: "expire"; durations?: Partial<DurationConfig> }
  | { action: "switch"; taskId: number; durations?: Partial<DurationConfig> }
  | { action: "skip"; durations?: Partial<DurationConfig> };

export async function POST(request: Request) {
  const roomId = getRoomId(request);
  const body = (await request.json()) as SessionAction;
  const nowMs = Date.now();

  const session = await getOrCreateSession(roomId);
  const current = dbToTimerState(session);

  let next = current;
  switch (body.action) {
    case "start":
      next = start(current, nowMs, body.taskId ?? null, body.durations);
      break;
    case "pause":
      next = pause(current, nowMs);
      break;
    case "resume":
      next = resume(current, nowMs);
      break;
    case "restart":
      next = restart(current, nowMs, body.durations);
      break;
    case "expire":
      next = tick(current, nowMs, body.durations);
      break;
    case "switch": {
      // เปลี่ยน task ที่กำลังทำ → void ลูกปัจจุบัน + start WORK ใหม่กับ taskId
      await voidCurrentSlot(roomId);
      next = workWith(current, nowMs, body.taskId, body.durations);
      break;
    }
    case "skip": {
      // ข้าม task ปัจจุบัน → void + ไป task ถัดไปอัตโนมัติ (หรือ IDLE ถ้าคิวว่าง)
      await voidCurrentSlot(roomId);
      const nextTask = await prisma.task.findFirst({
        where: {
          roomId,
          status: { in: ["pending", "in-progress"] },
          ...(current.currentTaskId != null ? { id: { not: current.currentTaskId } } : {}),
        },
        orderBy: [{ priority: "desc" }, { id: "asc" }],
      });
      if (nextTask) {
        next = workWith(current, nowMs, nextTask.id, body.durations);
      } else {
        next = { ...INITIAL_STATE, completedPomodoros: current.completedPomodoros };
      }
      break;
    }
    default:
      return Response.json({ error: "unknown action" }, { status: 400 });
  }

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: timerStateToDb(next),
  });

  return Response.json(dbToTimerState(updated));
}
