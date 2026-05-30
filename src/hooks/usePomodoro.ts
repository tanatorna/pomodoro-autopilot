"use client";
// ─────────────────────────────────────────────
// usePomodoro Hook
// Bridge ระหว่าง Engine (pure functions) ↔ API ↔ UI
//
// หน้าที่:
//   1. โหลด session state จาก DB ตอน mount
//   2. รัน ticker ทุก 1 วินาที → คำนวณ remaining
//   3. ตรวจจับ expiry → เรียก POST /api/session { action: "expire" }
//   4. expose actions (start/pause/resume/restart) ให้ UI เรียก
//   5. request Notification permission ตอน start ครั้งแรก
// ─────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type TimerState,
  INITIAL_STATE,
  computeRemaining,
  formatTime,
  isExpired,
} from "@/engine";

// ─── Types ───────────────────────────────────

interface UsePomodoroReturn {
  /** Timer state ปัจจุบัน (มาจาก DB ผ่าน API) */
  timerState: TimerState;
  /** เวลาที่เหลือ format "MM:SS" — คำนวณ client-side ทุก tick */
  display: string;
  /** ms ที่เหลือ — ใช้สำหรับ progress bar */
  remainingMs: number;
  /** กำลัง loading อยู่ไหม */
  loading: boolean;
  /** Actions */
  handleStart: (taskId?: number) => Promise<void>;
  handlePause: () => Promise<void>;
  handleResume: () => Promise<void>;
  handleRestart: () => Promise<void>;
}

// ─── Helper ──────────────────────────────────

async function callSessionAPI(
  body: Record<string, unknown>
): Promise<TimerState> {
  const res = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<TimerState>;
}

function notify(title: string, body: string) {
  if (typeof window === "undefined") return;
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico" });
  }
}

// ─── Hook ────────────────────────────────────

export function usePomodoro(): UsePomodoroReturn {
  const [timerState, setTimerState] = useState<TimerState>(INITIAL_STATE);
  const [loading, setLoading] = useState(true);

  // remainingMs คำนวณ client-side ทุก tick (ไม่ต้อง fetch API ทุกวินาที)
  const [remainingMs, setRemainingMs] = useState(0);

  // ใช้ ref เพื่อเข้าถึง timerState ล่าสุดใน setInterval โดยไม่ re-create interval
  const timerStateRef = useRef<TimerState>(INITIAL_STATE);

  // ─── Load session on mount ─────────────────
  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json() as Promise<TimerState>)
      .then((state) => {
        setTimerState(state);
        timerStateRef.current = state;
        if (state.endsAt) {
          // WORK / BREAK กำลังเดิน → คำนวณจาก endsAt
          setRemainingMs(computeRemaining(state.endsAt, Date.now()));
        } else if (state.remainingMs !== null) {
          // PAUSED → ใช้ remainingMs ที่เก็บไว้ใน DB
          setRemainingMs(state.remainingMs);
        }
      })
      .finally(() => setLoading(false));

    // Request notification permission
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  // ─── Ticker ───────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const state = timerStateRef.current;

      // ไม่มีอะไรให้ tick
      if (state.state === "IDLE" || state.state === "PAUSED") return;
      if (state.endsAt === null) return;

      const nowMs = Date.now();

      if (isExpired(state.endsAt, nowMs)) {
        // Timer หมดเวลา → notify + บันทึก transition ลง DB
        const label =
          state.state === "WORK" ? "หมดเวลาทำงาน! 🍅" : "หมดเวลา Break! 💪";
        const body =
          state.state === "WORK"
            ? "เริ่ม Break ได้เลย"
            : "พร้อมทำงานรอบใหม่";
        notify(label, body);

        callSessionAPI({ action: "expire" }).then((next) => {
          setTimerState(next);
          timerStateRef.current = next;
          setRemainingMs(next.endsAt ? computeRemaining(next.endsAt, Date.now()) : 0);
        });
      } else {
        setRemainingMs(computeRemaining(state.endsAt, nowMs));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // ─── Sync ref เมื่อ timerState เปลี่ยน ────
  useEffect(() => {
    timerStateRef.current = timerState;
  }, [timerState]);

  // ─── Visibility change (catch-up) ─────────
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      const state = timerStateRef.current;
      if (state.state === "IDLE" || state.state === "PAUSED") return;
      if (state.endsAt === null) return;

      // กลับมาที่ tab → ตรวจ catch-up ทันที
      const nowMs = Date.now();
      if (isExpired(state.endsAt, nowMs)) {
        callSessionAPI({ action: "expire" }).then((next) => {
          setTimerState(next);
          timerStateRef.current = next;
          setRemainingMs(next.endsAt ? computeRemaining(next.endsAt, Date.now()) : 0);
        });
      } else {
        setRemainingMs(computeRemaining(state.endsAt, nowMs));
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // ─── Actions ──────────────────────────────

  const handleStart = useCallback(async (taskId?: number) => {
    const next = await callSessionAPI({ action: "start", taskId });
    setTimerState(next);
    timerStateRef.current = next;
    setRemainingMs(next.endsAt ? computeRemaining(next.endsAt, Date.now()) : 0);
  }, []);

  const handlePause = useCallback(async () => {
    const next = await callSessionAPI({ action: "pause" });
    setTimerState(next);
    timerStateRef.current = next;
  }, []);

  const handleResume = useCallback(async () => {
    const next = await callSessionAPI({ action: "resume" });
    setTimerState(next);
    timerStateRef.current = next;
    setRemainingMs(next.endsAt ? computeRemaining(next.endsAt, Date.now()) : 0);
  }, []);

  const handleRestart = useCallback(async () => {
    const next = await callSessionAPI({ action: "restart" });
    setTimerState(next);
    timerStateRef.current = next;
    setRemainingMs(next.endsAt ? computeRemaining(next.endsAt, Date.now()) : 0);
  }, []);

  return {
    timerState,
    display: formatTime(remainingMs),
    remainingMs,
    loading,
    handleStart,
    handlePause,
    handleResume,
    handleRestart,
  };
}
