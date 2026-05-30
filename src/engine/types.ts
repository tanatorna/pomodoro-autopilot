// ─────────────────────────────────────────────
// Pomodoro Engine — Types
// Pure types only. No imports, no I/O.
// ─────────────────────────────────────────────

/** สถานะทั้งหมดของ timer */
export type State =
  | "IDLE"
  | "WORK"
  | "SHORT_BREAK"
  | "LONG_BREAK"
  | "PAUSED";

/**
 * Origin = state ก่อนที่จะ PAUSED
 * ใช้เพื่อ resume กลับให้ถูก state
 */
export type PausedOrigin = "WORK" | "SHORT_BREAK" | "LONG_BREAK";

/**
 * TimerState = snapshot ของ engine ณ เวลาหนึ่ง
 *
 * หลักการ timestamp-based timer:
 *   - ไม่นับ tick → เก็บ endsAt (เวลาที่จะหมด)
 *   - remaining = endsAt - Date.now()
 *   - ถ้า tab ถูก throttle แล้วกลับมา → คำนวณ catch-up อัตโนมัติ
 */
export interface TimerState {
  /** สถานะปัจจุบัน */
  state: State;

  /**
   * timestamp (ms) ที่ timer จะหมด
   * มีค่าเฉพาะตอน WORK / SHORT_BREAK / LONG_BREAK
   * null เมื่อ IDLE หรือ PAUSED
   */
  endsAt: number | null;

  /**
   * เวลาที่เหลือค้างไว้ตอน Pause (ms)
   * มีค่าเฉพาะตอน PAUSED
   * null เมื่อ state อื่น
   */
  remainingMs: number | null;

  /**
   * state ก่อนหน้าที่จะ PAUSED
   * ใช้ตอน resume เพื่อรู้ว่าต้องกลับไป WORK หรือ BREAK
   * null เมื่อ state ไม่ใช่ PAUSED
   */
  origin: PausedOrigin | null;

  /**
   * จำนวน Pomodoro ที่เดินถึง 0 แล้ว (นับสำเร็จ)
   * restart ไม่นับ — นับเฉพาะที่เดินจนหมด
   * ใช้ตัดสิน SHORT_BREAK vs LONG_BREAK (ทุก 4 รอบ)
   */
  completedPomodoros: number;

  /** id ของ Task ที่กำลังทำงานอยู่ (null = ยังไม่มี) */
  currentTaskId: number | null;
}

/** Duration constants (ms) */
export const DURATIONS = {
  WORK: 25 * 60 * 1000,        // 25 นาที
  SHORT_BREAK: 5 * 60 * 1000,  // 5 นาที
  LONG_BREAK: 15 * 60 * 1000,  // 15 นาที
  POMODOROS_PER_LONG_BREAK: 4, // ทุก 4 รอบ → LONG_BREAK
} as const;

/** Initial state — จุดเริ่มต้นของ engine */
export const INITIAL_STATE: TimerState = {
  state: "IDLE",
  endsAt: null,
  remainingMs: null,
  origin: null,
  completedPomodoros: 0,
  currentTaskId: null,
};
