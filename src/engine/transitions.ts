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

/**
 * start — IDLE → WORK
 * เริ่ม Pomodoro แรก
 *
 * @param state     - ต้องเป็น IDLE
 * @param nowMs     - Date.now()
 * @param taskId    - Task ที่จะทำ
 */
export function start(
  state: TimerState,
  nowMs: number,
  taskId: number | null = null
): TimerState {
  if (state.state !== "IDLE") return state; // guard: ไม่ทำอะไรถ้า state ไม่ถูก

  return {
    ...state,
    state: "WORK",
    endsAt: computeEndsAt("WORK", nowMs),
    remainingMs: null,
    origin: null,
    currentTaskId: taskId,
  };
}

/**
 * pause — WORK | SHORT_BREAK | LONG_BREAK → PAUSED
 * หยุดเวลา บันทึก remainingMs และ origin ไว้
 *
 * @param state   - ต้องเป็น WORK | SHORT_BREAK | LONG_BREAK
 * @param nowMs   - Date.now()
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
 * เดินต่อจากเวลาที่ค้างไว้
 *
 * @param state   - ต้องเป็น PAUSED
 * @param nowMs   - Date.now()
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
 * restart — WORK | PAUSED → WORK (reset 25:00)
 * ลูกที่ทิ้งไม่นับ completedPomodoros
 *
 * @param state   - ต้องเป็น WORK หรือ PAUSED
 * @param nowMs   - Date.now()
 */
export function restart(state: TimerState, nowMs: number): TimerState {
  const restartableStates: TimerState["state"][] = ["WORK", "PAUSED"];
  if (!restartableStates.includes(state.state)) return state;

  return {
    ...state,
    state: "WORK",
    endsAt: computeEndsAt("WORK", nowMs),
    remainingMs: null,
    origin: null,
    // completedPomodoros ไม่เพิ่ม — ลูกที่ทิ้งไม่นับ
  };
}

/**
 * tick — ตรวจสอบว่า timer หมดเวลาหรือยัง
 * ถ้าหมด → transition อัตโนมัติ (WORK→BREAK หรือ BREAK→WORK)
 * ถ้ายังไม่หมด → คืน state เดิม
 *
 * เรียกทุก 1 วินาทีจาก UI hook
 * รวม catch-up: ถ้า tab throttle แล้วกลับมา เรียกครั้งเดียวก็ transition ได้เลย
 *
 * @param state   - state ปัจจุบัน
 * @param nowMs   - Date.now()
 */
export function tick(state: TimerState, nowMs: number): TimerState {
  // ไม่มีอะไรให้ tick ใน IDLE หรือ PAUSED
  if (state.state === "IDLE" || state.state === "PAUSED") return state;
  if (state.endsAt === null) return state;

  // ยังไม่หมดเวลา
  if (nowMs < state.endsAt) return state;

  // หมดเวลาแล้ว → transition
  return _expire(state, nowMs);
}

/**
 * _expire (internal) — transition เมื่อ timer ถึง 0
 * แยกออกมาเพื่อให้ test ง่ายและ reuse ได้
 */
function _expire(state: TimerState, nowMs: number): TimerState {
  if (state.state === "WORK") {
    const newCompleted = state.completedPomodoros + 1;
    const isLongBreak =
      newCompleted % DURATIONS.POMODOROS_PER_LONG_BREAK === 0;
    const nextState = isLongBreak ? "LONG_BREAK" : "SHORT_BREAK";

    return {
      ...state,
      state: nextState,
      endsAt: computeEndsAt(nextState, nowMs),
      remainingMs: null,
      origin: null,
      completedPomodoros: newCompleted,
    };
  }

  if (state.state === "SHORT_BREAK" || state.state === "LONG_BREAK") {
    return {
      ...state,
      state: "WORK",
      endsAt: computeEndsAt("WORK", nowMs),
      remainingMs: null,
      origin: null,
    };
  }

  return state;
}

/**
 * reset — กลับสู่ INITIAL_STATE
 * ใช้ตอนจบวัน หรือ clear ทุกอย่าง
 */
export function reset(): TimerState {
  return { ...INITIAL_STATE };
}
