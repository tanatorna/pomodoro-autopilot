// GET  /api/session          — คืน session ปัจจุบัน (สร้างใหม่ถ้ายังไม่มี)
// POST /api/session          — รับ action แล้ว apply engine transition → save → คืน new state
//
// Actions:
//   { action: "start",   taskId?: number }
//   { action: "pause"  }
//   { action: "resume" }
//   { action: "restart"}
//   { action: "expire" }  ← UI hook เรียกตอน tick() ตรวจว่าหมดเวลา

import { prisma } from "@/lib/prisma";
import { dbToTimerState, timerStateToDb } from "@/lib/sessionMapper";
import { start, pause, resume, restart, tick } from "@/engine/transitions";
import { INITIAL_STATE } from "@/engine/types";

/** ดึง session ปัจจุบัน หรือสร้างใหม่ถ้ายังไม่มี */
async function getOrCreateSession() {
  const existing = await prisma.session.findFirst({
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  return prisma.session.create({ data: timerStateToDb(INITIAL_STATE) });
}

export async function GET() {
  const session = await getOrCreateSession();
  return Response.json(dbToTimerState(session));
}

type SessionAction =
  | { action: "start"; taskId?: number }
  | { action: "pause" }
  | { action: "resume" }
  | { action: "restart" }
  | { action: "expire" };

export async function POST(request: Request) {
  const body = (await request.json()) as SessionAction;
  const nowMs = Date.now();

  const session = await getOrCreateSession();
  const current = dbToTimerState(session);

  // Apply transition ตาม action
  let next = current;
  switch (body.action) {
    case "start":
      next = start(current, nowMs, body.taskId ?? null);
      break;
    case "pause":
      next = pause(current, nowMs);
      break;
    case "resume":
      next = resume(current, nowMs);
      break;
    case "restart":
      next = restart(current, nowMs);
      break;
    case "expire":
      // UI hook เรียกเมื่อ tick() ตรวจพบว่าหมดเวลาแล้ว
      next = tick(current, nowMs);
      break;
    default:
      return Response.json({ error: "unknown action" }, { status: 400 });
  }

  // บันทึก state ใหม่ลง DB
  const updated = await prisma.session.update({
    where: { id: session.id },
    data: timerStateToDb(next),
  });

  return Response.json(dbToTimerState(updated));
}
