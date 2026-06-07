// ─────────────────────────────────────────────
// Pomodoro Engine — FSM Transitions
// Pure functions. No side effects. No I/O.
// Input (state + now) → Output (new state)
// ─────────────────────────────────────────────

import {
  DURATIONS,
  INITIAL_STATE,
  type PausedOrigin,
  type TimerState,
} from "./types";
import { computeEndsAt, computeEndsAtFromRemaining, computeRemaining } from "./timeMath";

/** Custom durations (ms) — ถ้าไม่ส่ง จะ fallback ไป DURATIONS default */
export interface DurationConfig {
  WORK: number;
  SHORT_BREAK: number;
  LONG_BREAK: number;
  POMODOROS_PER_LONG_BREAK: number;
}

function getDurations(custom?: Partial<DurationConfig>): DurationConfig {
  return { ...DURATIONS, ...custom };
}

/**
 * start — IDLE → WORK
 */
export function start(
  state: TimerState,
  nowMs: number,
  taskId: number | null = null,
  custom?: Partial<DurationConfig>
): TimerState {
  if (state.state !== "IDLE") return state;
  const d = getDurations(custom);

  return {
    ...state,
    state: "WORK",
    endsAt: nowMs + d.WORK,
    remainingMs: null,
    origin: null,
    // เริ่ม session ใหม่ → รีเซ็ตตัวนับ cadence (long break นับใหม่ต่อ session)
    // ไม่งั้นตัวนับสะสมเดิมทำให้ลูกแรกอาจเด้ง long break ทันที (cadence เลื่อน)
    completedPomodoros: 0,
    currentTaskId: taskId,
  };
}

/**
 * pause — WORK | SHORT_BREAK | LONG_BREAK → PAUSED
 */
export function pause(state: TimerState, nowMs: number): TimerState {
  const pausableStates: TimerState["state"][] = [
    "WORK",
    "SHORT_BREAK",
    "LONG_BREAK",
  ];
  if (!pausableStates.includes(state.state)) return state;
  if (state.endsAt === null) return state;

  return {
    ...state,
    state: "PAUSED",
    endsAt: null,
    remainingMs: computeRemaining(state.endsAt, nowMs),
    origin: state.state as PausedOrigin,
  };
}

/**
 * resume — PAUSED → (origin state)
 */
export function resume(state: TimerState, nowMs: number): TimerState {
  if (state.state !== "PAUSED") return state;
  if (state.remainingMs === null || state.origin === null) return state;

  return {
    ...state,
    state: state.origin,
    endsAt: computeEndsAtFromRemaining(state.remainingMs, nowMs),
    remainingMs: null,
    origin: null,
  };
}

/**
 * restart — WORK | PAUSED → WORK (reset duration)
 * ลูกที่ทิ้งไม่นับ completedPomodoros
 */
export function restart(
  state: TimerState,
  nowMs: number,
  custom?: Partial<DurationConfig>
): TimerState {
  const restartableStates: TimerState["state"][] = ["WORK", "PAUSED"];
  if (!restartableStates.includes(state.state)) return state;
  const d = getDurations(custom);

  return {
    ...state,
    state: "WORK",
    endsAt: nowMs + d.WORK,
    remainingMs: null,
    origin: null,
  };
}

/**
 * tick — ตรวจสอบว่า timer หมดเวลาหรือยัง
 */
export function tick(
  state: TimerState,
  nowMs: number,
  custom?: Partial<DurationConfig>
): TimerState {
  if (state.state === "IDLE" || state.state === "PAUSED") return state;
  if (state.endsAt === null) return state;
  if (nowMs < state.endsAt) return state;

  return _expire(state, nowMs, custom);
}

/**
 * _expire (internal) — transition เมื่อ timer ถึง 0
 */
function _expire(
  state: TimerState,
  nowMs: number,
  custom?: Partial<DurationConfig>
): TimerState {
  const d = getDurations(custom);

  if (state.state === "WORK") {
    const newCompleted = state.completedPomodoros + 1;
    const isLongBreak = newCompleted % d.POMODOROS_PER_LONG_BREAK === 0;
    const nextState = isLongBreak ? "LONG_BREAK" : "SHORT_BREAK";

    return {
      ...state,
      state: nextState,
      endsAt: nowMs + d[nextState],
      remainingMs: null,
      origin: null,
      completedPomodoros: newCompleted,
    };
  }

  if (state.state === "SHORT_BREAK" || state.state === "LONG_BREAK") {
    return {
      ...state,
      state: "WORK",
      endsAt: nowMs + d.WORK,
      remainingMs: null,
      origin: null,
    };
  }

  return state;
}

/**
 * reset — กลับสู่ INITIAL_STATE
 */
export function reset(): TimerState {
  return { ...INITIAL_STATE };
}
