// ─────────────────────────────────────────────
// Pomodoro Engine — Time Math
// Pure functions. No side effects. No I/O.
// Input → Output เสมอ ไม่มี state ข้างนอก
// ─────────────────────────────────────────────

import { DURATIONS, type State } from "./types";

/**
 * คำนวณ endsAt timestamp สำหรับ state ที่กำหนด
 * เริ่มจาก now
 *
 * @param state   - WORK | SHORT_BREAK | LONG_BREAK
 * @param nowMs   - Date.now() ณ ขณะนั้น (ส่งเข้ามาเพื่อให้ testable)
 * @returns       - timestamp ms ที่ timer จะหมด
 */
export function computeEndsAt(
  state: Extract<State, "WORK" | "SHORT_BREAK" | "LONG_BREAK">,
  nowMs: number
): number {
  return nowMs + DURATIONS[state];
}

/**
 * คำนวณ endsAt สำหรับ Resume
 * ใช้ remainingMs ที่เก็บไว้ตอน Pause + now
 *
 * @param remainingMs - เวลาที่เหลือตอน Pause (ms)
 * @param nowMs       - Date.now() ณ ขณะ Resume
 * @returns           - timestamp ms ใหม่ที่ timer จะหมด
 */
export function computeEndsAtFromRemaining(
  remainingMs: number,
  nowMs: number
): number {
  return nowMs + remainingMs;
}

/**
 * คำนวณเวลาที่เหลือ (ms) จาก endsAt
 * ถ้า endsAt ผ่านไปแล้ว → คืน 0 (ไม่ติดลบ)
 *
 * @param endsAt  - timestamp ms ที่ timer จะหมด
 * @param nowMs   - Date.now() ณ ขณะนั้น
 * @returns       - ms ที่เหลือ (>= 0)
 */
export function computeRemaining(endsAt: number, nowMs: number): number {
  return Math.max(0, endsAt - nowMs);
}

/**
 * ตรวจว่า timer หมดเวลาแล้วหรือยัง
 * รวม catch-up logic: ถ้า tab ถูก throttle แล้วกลับมา
 * ฟังก์ชันนี้จะยังคืน true แม้เลย endsAt ไปนานแล้ว
 *
 * @param endsAt  - timestamp ms ที่ timer จะหมด
 * @param nowMs   - Date.now() ณ ขณะนั้น
 * @returns       - true ถ้าหมดเวลาแล้ว
 */
export function isExpired(endsAt: number, nowMs: number): boolean {
  return nowMs >= endsAt;
}

/**
 * แปลง ms → { minutes, seconds } สำหรับแสดงผล UI
 *
 * @param ms  - milliseconds
 * @returns   - { minutes: number, seconds: number }
 */
export function msToDisplay(ms: number): { minutes: number; seconds: number } {
  const totalSeconds = Math.ceil(ms / 1000);
  return {
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60,
  };
}

/**
 * Format เป็น string "MM:SS" สำหรับแสดงบน UI
 *
 * @param ms  - milliseconds
 * @returns   - string เช่น "25:00", "04:59"
 */
export function formatTime(ms: number): string {
  const { minutes, seconds } = msToDisplay(ms);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
