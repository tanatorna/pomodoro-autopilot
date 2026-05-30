import { prisma } from "@/lib/prisma";
import { getRoomId } from "@/lib/room";
import { dbToTimerState, timerStateToDb } from "@/lib/sessionMapper";
import { start, pause, resume, restart, tick, type DurationConfig } from "@/engine/transitions";
import { INITIAL_STATE } from "@/engine/types";

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
  | { action: "expire"; durations?: Partial<DurationConfig> };

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
    default:
      return Response.json({ error: "unknown action" }, { status: 400 });
  }

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: timerStateToDb(next),
  });

  return Response.json(dbToTimerState(updated));
}
