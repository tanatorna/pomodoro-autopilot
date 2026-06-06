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
  tick,
} from "@/engine";
import type { DurationConfig } from "@/engine/transitions";
import { playAlarm, primeAudio } from "@/lib/sound";

interface UsePomodoroReturn {
  timerState: TimerState;
  display: string;
  remainingMs: number;
  loading: boolean;
  handleStart: (taskId?: number) => Promise<void>;
  handlePause: () => Promise<void>;
  handleResume: () => Promise<void>;
  handleRestart: () => Promise<void>;
  handleSwitchTask: (taskId: number) => Promise<void>;
  handleSkip: () => Promise<void>;
  refresh: () => Promise<void>;
  syncError: string | null;
  wakeLockActive: boolean;
}

async function callSessionAPI(
  body: Record<string, unknown>,
  headers: Record<string, string>,
  timeoutMs = 8000
): Promise<TimerState> {
  // timeout/abort — กัน request ค้างถาวร (เช่น connection ตายเงียบๆ ตอน resume จากล็อคจอมือถือ)
  // ถ้าไม่ abort, promise จะไม่ settle → expiringRef ติด true → timer แข็งค้าง
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("/api/session", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`); // เช่น 402 (Vercel disabled), 500
    return res.json() as Promise<TimerState>;
  } finally {
    clearTimeout(timer);
  }
}

function notify(title: string, body: string) {
  if (typeof window === "undefined") return;
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/icon.svg" });
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
  const [syncError, setSyncError] = useState<string | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);

  const timerStateRef = useRef<TimerState>(INITIAL_STATE);
  const durationsRef = useRef(durations);
  const headersRef = useRef(roomHeaders);
  const expiringRef = useRef(false); // in-flight guard ระหว่างรอ API
  // key = endsAt ของ "ลูก pomodoro" ที่เล่น alarm ไปแล้ว
  // กัน alarm รัวๆ ตอนเน็ตตัด: API fail → state ไม่อัปเดต → ticker ครั้งถัดมาเห็น state เดิม (expired)
  // → ปลด guard แล้วลอง trigger อีก แต่ alarm key เท่าเดิม ⇒ ไม่ alarm ซ้ำ
  // เมื่อเน็ตกลับ + API สำเร็จ → state ใหม่ endsAt เปลี่ยน → key ต่าง → alarm ครั้งใหม่ทำได้
  const alarmedForEndsAtRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => { durationsRef.current = durations; }, [durations]);
  useEffect(() => { headersRef.current = roomHeaders; }, [roomHeaders]);

  // ─── หมดเวลา (ใช้ร่วมกันทั้ง ticker + visibility) ─────────
  const triggerExpire = useCallback(() => {
    if (expiringRef.current) return;
    expiringRef.current = true;

    const state = timerStateRef.current;
    const endsAtKey = state.endsAt;

    // alarm/notify ครั้งเดียวต่อ expire event (endsAt) — กัน loop ตอน API fail
    if (endsAtKey !== null && alarmedForEndsAtRef.current !== endsAtKey) {
      alarmedForEndsAtRef.current = endsAtKey;
      playAlarm(state.state === "WORK" ? "work" : "break");
      const label = state.state === "WORK" ? "หมดเวลาทำงาน! 🍅" : "หมดเวลา Break! 💪";
      const body = state.state === "WORK" ? "เริ่ม Break ได้เลย" : "พร้อมทำงานรอบใหม่";
      notify(label, body);
    }

    // OPTIMISTIC transition — คำนวณ state ถัดไปในเครื่องด้วย engine (pure) แล้วอัปเดตจอทันที
    // ไม่รอ server → display ไม่ค้างแม้ expire request ช้า/ค้าง (สาเหตุของ "ค้างที่ 00:01")
    // server จะ reconcile ทีหลัง (จัดการ task counting + เลื่อน task — logic ฝั่ง server)
    const localNext = tick(state, Date.now(), durationsRef.current);
    if (localNext !== state) {
      setTimerState(localNext);
      timerStateRef.current = localNext;
      setRemainingMs(localNext.endsAt ? computeRemaining(localNext.endsAt, Date.now()) : 0);
    }

    // sync server (authoritative) แล้ว reconcile · retry ทุก tick ถ้า fail
    callSessionAPI({ action: "expire", durations: durationsRef.current }, headersRef.current)
      .then((next) => {
        setTimerState(next);
        timerStateRef.current = next;
        setRemainingMs(next.endsAt ? computeRemaining(next.endsAt, Date.now()) : 0);
        setSyncError(null); // สำเร็จ → เคลียร์ error
      })
      .catch((err) => {
        // ล้มเหลว → แจ้ง user (เดิมเงียบ ทำให้ "ค้าง" โดยไม่รู้สาเหตุ) · จะ retry ใน tick ถัดไป
        const status = String((err as Error)?.message ?? "");
        setSyncError(
          status.includes("402")
            ? "เชื่อมต่อ server ไม่ได้ (402) — เช็คว่าใช้โดเมนถูก/Vercel ยัง active"
            : "ซิงค์ไม่สำเร็จ — เน็ตมีปัญหา กำลังลองใหม่…"
        );
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

  // ─── re-fetch session จาก server (ใช้แทน reload หลัง endDay/interrupt) ─
  const refresh = useCallback(async () => {
    const headers = headersRef.current;
    if (!headers["X-Room-Id"]) return;
    const next = (await (await fetch("/api/session", { headers })).json()) as TimerState;
    setTimerState(next);
    timerStateRef.current = next;
    setRemainingMs(
      next.endsAt ? computeRemaining(next.endsAt, Date.now()) : next.remainingMs ?? 0
    );
  }, []);

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

  // ─── Screen Wake Lock ─────────────────────
  // กันจอดับระหว่าง timer เดิน → หน้าไม่ถูก suspend → ticker เดินต่อ → เสียง/noti ดังตรงเวลา
  // (ทำงานเฉพาะตอนแอปเปิดอยู่ · ถ้า user กดล็อคเอง/สลับแอป OS ยังปล่อย lock — ไม่ใช่ push)
  useEffect(() => {
    const running =
      timerState.state === "WORK" ||
      timerState.state === "SHORT_BREAK" ||
      timerState.state === "LONG_BREAK";

    async function acquire() {
      if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
        setWakeLockActive(false);
        return;
      }
      if (wakeLockRef.current) return;
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        wakeLockRef.current = sentinel;
        setWakeLockActive(true);
        // ถูกปล่อยอัตโนมัติ (เช่นจอ hide) → เคลียร์ ref ไว้ให้ re-acquire ได้
        sentinel.addEventListener("release", () => {
          if (wakeLockRef.current === sentinel) wakeLockRef.current = null;
          setWakeLockActive(false);
        });
      } catch {
        // ไม่รองรับ / ถูกปฏิเสธ (เช่น Samsung battery management) → แสดงสถานะให้ user รู้
        setWakeLockActive(false);
      }
    }

    async function release() {
      const sentinel = wakeLockRef.current;
      wakeLockRef.current = null;
      setWakeLockActive(false);
      if (sentinel) {
        try { await sentinel.release(); } catch { /* ignore */ }
      }
    }

    if (running) {
      void acquire();
    } else {
      void release();
    }

    // re-acquire เมื่อกลับมา visible (wake lock ถูกปล่อยอัตโนมัติตอน tab hidden)
    function onVisible() {
      if (document.visibilityState === "visible" && running) void acquire();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [timerState.state]);

  // ─── Actions ──────────────────────────────

  const handleStart = useCallback(async (taskId?: number) => {
    primeAudio(); // ปลดล็อกเสียงระหว่าง gesture นี้ → alarm ดังตอน timer หมด (มือถือ)
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
    primeAudio(); // ปลดล็อกเสียงระหว่าง gesture นี้ (มือถือ)
    const next = await callSessionAPI({ action: "resume" }, headersRef.current);
    setTimerState(next);
    timerStateRef.current = next;
    setRemainingMs(next.endsAt ? computeRemaining(next.endsAt, Date.now()) : 0);
  }, []);

  const handleRestart = useCallback(async () => {
    primeAudio();
    const next = await callSessionAPI({
      action: "restart",
      durations: durationsRef.current,
    }, headersRef.current);
    setTimerState(next);
    timerStateRef.current = next;
    setRemainingMs(next.endsAt ? computeRemaining(next.endsAt, Date.now()) : 0);
  }, []);

  /** เปลี่ยนไป task อื่นกลางคัน — void ลูกปัจจุบัน + start WORK ใหม่ */
  const handleSwitchTask = useCallback(async (taskId: number) => {
    primeAudio();
    const next = await callSessionAPI(
      { action: "switch", taskId, durations: durationsRef.current },
      headersRef.current
    );
    setTimerState(next);
    timerStateRef.current = next;
    setRemainingMs(next.endsAt ? computeRemaining(next.endsAt, Date.now()) : 0);
  }, []);

  /** ข้าม task ปัจจุบัน → ไป task ถัดไปอัตโนมัติ */
  const handleSkip = useCallback(async () => {
    primeAudio();
    const next = await callSessionAPI(
      { action: "skip", durations: durationsRef.current },
      headersRef.current
    );
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
    handleSwitchTask,
    handleSkip,
    refresh,
    syncError,
    wakeLockActive,
  };
}
