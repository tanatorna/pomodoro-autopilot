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

export function usePomodoro(
  durations?: Partial<DurationConfig>
): UsePomodoroReturn {
  const [timerState, setTimerState] = useState<TimerState>(INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const [remainingMs, setRemainingMs] = useState(0);

  const timerStateRef = useRef<TimerState>(INITIAL_STATE);
  const durationsRef = useRef(durations);
  useEffect(() => { durationsRef.current = durations; }, [durations]);

  // ─── Load session on mount ─────────────────
  useEffect(() => {
    fetch("/api/session")
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
        // 🔔 เล่นเสียงแจ้งเตือน
        playAlarm(state.state === "WORK" ? "work" : "break");

        // 📲 Web Notification
        const label = state.state === "WORK" ? "หมดเวลาทำงาน! 🍅" : "หมดเวลา Break! 💪";
        const body = state.state === "WORK" ? "เริ่ม Break ได้เลย" : "พร้อมทำงานรอบใหม่";
        notify(label, body);

        callSessionAPI({ action: "expire", durations: durationsRef.current }).then((next) => {
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
        playAlarm(state.state === "WORK" ? "work" : "break");
        callSessionAPI({ action: "expire", durations: durationsRef.current }).then((next) => {
          setTimerState(next);
          timerStateRef.current = next;
          setRemainingMs(next.endsAt ? computeRemaining(next.endsAt, Date.now()) : 0);
        });
      } else {
        setRemainingMs(computeRemaining(state.endsAt, nowMs));
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // ─── Actions ──────────────────────────────

  const handleStart = useCallback(async (taskId?: number) => {
    const next = await callSessionAPI({
      action: "start",
      taskId,
      durations: durationsRef.current,
    });
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
    const next = await callSessionAPI({
      action: "restart",
      durations: durationsRef.current,
    });
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
