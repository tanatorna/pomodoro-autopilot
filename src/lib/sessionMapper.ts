// ─────────────────────────────────────────────
// Session Mapper
// แปลง DB Session ↔ TimerState
// ─────────────────────────────────────────────

import type { Session } from "@/generated/prisma/client";
import type { TimerState, State, PausedOrigin } from "@/engine/types";

/** แปลง DB Session row → TimerState (ที่ engine ใช้) */
export function dbToTimerState(session: Session): TimerState {
  return {
    state: session.state as State,
    endsAt: session.endsAt ? session.endsAt.getTime() : null,
    remainingMs: session.remainingMs ?? null,
    origin: (session.origin as PausedOrigin) ?? null,
    completedPomodoros: session.completedPomodoros,
    currentTaskId: session.currentTaskId ?? null,
  };
}

/** แปลง TimerState → object ที่ Prisma เขียนลง DB ได้ */
export function timerStateToDb(
  ts: TimerState
): Omit<Session, "id" | "createdAt" | "updatedAt"> {
  return {
    state: ts.state,
    endsAt: ts.endsAt ? new Date(ts.endsAt) : null,
    remainingMs: ts.remainingMs,
    origin: ts.origin,
    completedPomodoros: ts.completedPomodoros,
    currentTaskId: ts.currentTaskId,
  };
}
