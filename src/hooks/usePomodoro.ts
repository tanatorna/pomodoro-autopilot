"use client";
// ─────────────────────────────────────────────
// usePomodoro Hook
// Bridge ระหว่าง Engine (pure functions) ↔ API ↔ UI
// ─────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type TimerState,
  INITIAL_STATE,
  computeRemaining,
  formatTime,
  isExpired,
} from "@/engine";
import type { DurationConfig } from "@/engine/transitions";
import { playAlarm } from "@/lib/sound";

interface UsePomodoroReturn {
  timerState: TimerState;
  display: string;
  remainingMs: number;
  loading: boolean;
  handleStart: (taskId?: number) => Promise<void>;
  handlePause: () => Promise<void>;
  handleResume: () => Promise<void>;
  handleRestart: () => Promise<void>;
}

async function callSessionAPI(
  body: Record<string, unknown>,
  headers: Record<string, string>
): Promise<TimerState> {
  const res = await fetch("/api/session", {
    method: "POST",
    headers,
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

export function usePomodoro(
  durations?: Partial<DurationConfig>,
  roomHeaders: Record<string, string> = { "Content-Type": "application/json" }
): UsePomodoroReturn {
  const [timerState, setTimerState] = useState<TimerState>(INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const [remainingMs, setRemainingMs] = useState(0);

  const timerStateRef = useRef<TimerState>(INITIAL_STATE);
  const durationsRef = useRef(durations);
  const headersRef = useRef(roomHeaders);
  const expiringRef = useRef(false); // กันยิง expire/แจ้งเตือนซ้ำระหว่างรอ API
  useEffect(() => { durationsRef.current = durations; }, [durations]);
  useEffect(() => { headersRef.current = roomHeaders; }, [roomHeaders]);

  // ─── หมดเวลา (ใช้ร่วมกันทั้ง ticker + visibility) ─────────
  // มี in-flight guard: ถ้ามี expire ค้างอยู่ จะไม่ยิงซ้ำ + ไม่แจ้งเตือนซ้ำ
  // (สำคัญตอน API ช้า/cold start — ticker เดินทุก 1 วิ แต่ state เก่ายัง expired อยู่)
  const triggerExpire = useCallback(() => {
    if (expiringRef.current) return;
    expiringRef.current = true;

    const state = timerStateRef.current;
    playAlarm(state.state === "WORK" ? "work" : "break");
    const label = state.state === "WORK" ? "หมดเวลาทำงาน! 🍅" : "หมดเวลา Break! 💪";
    const body = state.state === "WORK" ? "เริ่ม Break ได้เลย" : "พร้อมทำงานรอบใหม่";
    notify(label, body);

    callSessionAPI({ action: "expire", durations: durationsRef.current }, headersRef.current)
      .then((next) => {
        setTimerState(next);
        timerStateRef.current = next;
        setRemainingMs(next.endsAt ? computeRemaining(next.endsAt, Date.now()) : 0);
      })
      .finally(() => { expiringRef.current = false; });
  }, []);

  // ─── Load session เมื่อ room พร้อม ─────────
  // รอจน roomHeaders มี X-Room-Id ก่อน ไม่งั้นจะโหลด session ของห้อง "default"
  // (ตอน mount แรก roomId ยังเป็น "" → header ยังไม่มี) และ re-run เมื่อ room เปลี่ยน
  useEffect(() => {
    if (!roomHeaders["X-Room-Id"]) return;
    fetch("/api/session", { headers: roomHeaders })
      .then((r) => r.json() as Promise<TimerState>)
      .then((state) => {
        setTimerState(state);
        timerStateRef.current = state;
        if (state.endsAt) {
          setRemainingMs(computeRemaining(state.endsAt, Date.now()));
        } else if (state.remainingMs !== null) {
          setRemainingMs(state.remainingMs);
        }
      })
      .finally(() => setLoading(false));
  }, [roomHeaders]);

  // ─── ขอ permission แจ้งเตือน (ครั้งเดียวตอน mount) ─
  useEffect(() => {
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
      if (state.state === "IDLE" || state.state === "PAUSED") return;
      if (state.endsAt === null) return;

      const nowMs = Date.now();

      if (isExpired(state.endsAt, nowMs)) {
        triggerExpire();
      } else {
        setRemainingMs(computeRemaining(state.endsAt, nowMs));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [triggerExpire]);

  // ─── Sync ref ──────────────────────────────
  useEffect(() => { timerStateRef.current = timerState; }, [timerState]);

  // ─── Visibility change (catch-up) ─────────
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      const state = timerStateRef.current;
      if (state.state === "IDLE" || state.state === "PAUSED") return;
      if (state.endsAt === null) return;

      const nowMs = Date.now();
      if (isExpired(state.endsAt, nowMs)) {
        triggerExpire();
      } else {
        setRemainingMs(computeRemaining(state.endsAt, nowMs));
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [triggerExpire]);

  // ─── Actions ──────────────────────────────

  const handleStart = useCallback(async (taskId?: number) => {
    const next = await callSessionAPI({
      action: "start",
      taskId,
      durations: durationsRef.current,
    }, headersRef.current);
    setTimerState(next);
    timerStateRef.current = next;
    setRemainingMs(next.endsAt ? computeRemaining(next.endsAt, Date.now()) : 0);
  }, []);

  const handlePause = useCallback(async () => {
    const next = await callSessionAPI({ action: "pause" }, headersRef.current);
    setTimerState(next);
    timerStateRef.current = next;
  }, []);

  const handleResume = useCallback(async () => {
    const next = await callSessionAPI({ action: "resume" }, headersRef.current);
    setTimerState(next);
    timerStateRef.current = next;
    setRemainingMs(next.endsAt ? computeRemaining(next.endsAt, Date.now()) : 0);
  }, []);

  const handleRestart = useCallback(async () => {
    const next = await callSessionAPI({
      action: "restart",
      durations: durationsRef.current,
    }, headersRef.current);
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
