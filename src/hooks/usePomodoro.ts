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

/** response อาจมี serverNow แนบมา (สำหรับ clock-offset) */
type SessionResponse = TimerState & { serverNow?: number };

async function callSessionAPI(
  body: Record<string, unknown>,
  headers: Record<string, string>,
  timeoutMs = 8000
): Promise<SessionResponse> {
  // HARD timeout ผ่าน Promise.race — reject แน่นอนไม่ว่า fetch หรือ res.json() จะค้าง
  // (บนมือถือเจอเคส abort fetch ได้ แต่ res.json() ที่อ่าน body ค้างอยู่ไม่ reject → promise ไม่ settle
  //  → .finally ไม่ทำงาน → expiringRef ค้าง BUSY ถาวร → timer แข็งค้าง)
  const controller = new AbortController();
  const fetchPromise = (async () => {
    const res = await fetch("/api/session", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`); // เช่น 402, 500
    return (await res.json()) as SessionResponse;
  })();
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => {
      controller.abort();
      reject(new Error("timeout"));
    }, timeoutMs)
  );
  return Promise.race([fetchPromise, timeoutPromise]);
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
  // clock offset: ms ที่ต้องบวกเข้า Date.now() ของ client เพื่อให้ได้เวลา server
  // กัน timer ค้าง: endsAt อิงนาฬิกา server ถ้า client เร็ว/ช้ากว่า จะ expire เหลื่อม → วน revert
  const clockOffsetRef = useRef(0);
  const nowServer = () => Date.now() + clockOffsetRef.current;
  /** อัปเดต offset จาก serverNow ที่แนบมากับ response */
  const syncClock = (serverNow?: number) => {
    if (typeof serverNow === "number") clockOffsetRef.current = serverNow - Date.now();
  };
  /** apply response → sync clock + set state + remaining (ใช้เวลา server) */
  const applyState = (next: SessionResponse) => {
    syncClock(next.serverNow);
    setTimerState(next);
    timerStateRef.current = next;
    setRemainingMs(
      next.endsAt ? computeRemaining(next.endsAt, nowServer()) : next.remainingMs ?? 0
    );
  };
  // key = endsAt ของ "ลูก pomodoro" ที่เล่น alarm ไปแล้ว
  // กัน alarm รัวๆ ตอนเน็ตตัด: API fail → state ไม่อัปเดต → ticker ครั้งถัดมาเห็น state เดิม (expired)
  // → ปลด guard แล้วลอง trigger อีก แต่ alarm key เท่าเดิม ⇒ ไม่ alarm ซ้ำ
  // เมื่อเน็ตกลับ + API สำเร็จ → state ใหม่ endsAt เปลี่ยน → key ต่าง → alarm ครั้งใหม่ทำได้
  const alarmedForEndsAtRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => { durationsRef.current = durations; }, [durations]);
  useEffect(() => { headersRef.current = roomHeaders; }, [roomHeaders]);

  // ─── หมดเวลา (ใช้ร่วมกันทั้ง ticker + visibility) ─────────
  // LOCAL-FIRST: ขยับ FSM ในเครื่องทันที (ไม่รอ/ไม่ถูกบล็อกด้วยเน็ต) → จอไม่มีวันค้าง
  // network sync เป็นแค่ best-effort + guarded แยก (กันยิง expire ซ้อน)
  const triggerExpire = useCallback(() => {
    const state = timerStateRef.current;
    if (state.endsAt === null) return;
    if (!isExpired(state.endsAt, nowServer())) return; // ยังไม่หมดจริง

    const endsAtKey = state.endsAt;

    // alarm/notify ครั้งเดียวต่อ expire event (endsAt)
    if (alarmedForEndsAtRef.current !== endsAtKey) {
      alarmedForEndsAtRef.current = endsAtKey;
      playAlarm(state.state === "WORK" ? "work" : "break");
      const label = state.state === "WORK" ? "หมดเวลาทำงาน! 🍅" : "หมดเวลา Break! 💪";
      const body = state.state === "WORK" ? "เริ่ม Break ได้เลย" : "พร้อมทำงานรอบใหม่";
      notify(label, body);
    }

    // ── OPTIMISTIC advance (นอก guard — ทำเสมอ ไม่ขึ้นกับเน็ต) ──
    // เปลี่ยน timerStateRef → tick ถัดไปจะเห็น state ใหม่ (ยังไม่หมด) จึงไม่ขยับซ้ำ = self-limiting
    const localNext = tick(state, nowServer(), durationsRef.current);
    if (localNext !== state) {
      setTimerState(localNext);
      timerStateRef.current = localNext;
      setRemainingMs(localNext.endsAt ? computeRemaining(localNext.endsAt, nowServer()) : 0);
    }

    // ── network sync (best-effort, guarded แยกเฉพาะ network) ──
    if (expiringRef.current) return; // มี expire ค้างอยู่ → ข้าม (local ขยับไปแล้ว ไม่ค้าง)
    expiringRef.current = true;
    callSessionAPI({ action: "expire", durations: durationsRef.current }, headersRef.current)
      .then((next) => {
        syncClock(next.serverNow);
        // reconcile เฉพาะเมื่อ server ขยับไป state ใหม่ (server-clamp การันตีขยับ)
        // ถ้า server ตอบ state เดิม (เหลื่อม) → ไม่ revert (local ถูกแล้ว)
        if (next.state !== state.state) {
          setTimerState(next);
          timerStateRef.current = next;
          setRemainingMs(next.endsAt ? computeRemaining(next.endsAt, nowServer()) : 0);
        }
        setSyncError(null);
      })
      .catch((err) => {
        const status = String((err as Error)?.message ?? "");
        // ไม่แจ้ง error ถ้าแค่ timeout (local ขยับไปแล้ว) · แจ้งเฉพาะ 402 (โดเมน/server ตาย)
        if (status.includes("402")) {
          setSyncError("เชื่อมต่อ server ไม่ได้ (402) — เช็คว่าใช้โดเมนถูก/Vercel ยัง active");
        }
      })
      .finally(() => { expiringRef.current = false; });
  }, []);

  // ─── Load session เมื่อ room พร้อม ─────────
  // รอจน roomHeaders มี X-Room-Id ก่อน ไม่งั้นจะโหลด session ของห้อง "default"
  // (ตอน mount แรก roomId ยังเป็น "" → header ยังไม่มี) และ re-run เมื่อ room เปลี่ยน
  useEffect(() => {
    if (!roomHeaders["X-Room-Id"]) return;
    fetch("/api/session", { headers: roomHeaders })
      .then((r) => r.json() as Promise<SessionResponse>)
      .then((state) => {
        syncClock(state.serverNow); // ตั้ง clock offset ตั้งแต่โหลด → expiry ตรงกับ server
        setTimerState(state);
        timerStateRef.current = state;
        if (state.endsAt) {
          setRemainingMs(computeRemaining(state.endsAt, nowServer()));
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
    const next = (await (await fetch("/api/session", { headers })).json()) as SessionResponse;
    syncClock(next.serverNow);
    setTimerState(next);
    timerStateRef.current = next;
    setRemainingMs(
      next.endsAt ? computeRemaining(next.endsAt, nowServer()) : next.remainingMs ?? 0
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

      const nowMs = nowServer(); // ใช้เวลา server → expiry ตรงกัน

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

      const nowMs = nowServer();
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
    applyState(next);
  }, []);

  const handlePause = useCallback(async () => {
    const next = await callSessionAPI({ action: "pause" }, headersRef.current);
    applyState(next);
  }, []);

  const handleResume = useCallback(async () => {
    primeAudio(); // ปลดล็อกเสียงระหว่าง gesture นี้ (มือถือ)
    const next = await callSessionAPI({ action: "resume" }, headersRef.current);
    applyState(next);
  }, []);

  const handleRestart = useCallback(async () => {
    primeAudio();
    const next = await callSessionAPI({
      action: "restart",
      durations: durationsRef.current,
    }, headersRef.current);
    applyState(next);
  }, []);

  /** เปลี่ยนไป task อื่นกลางคัน — void ลูกปัจจุบัน + start WORK ใหม่ */
  const handleSwitchTask = useCallback(async (taskId: number) => {
    primeAudio();
    const next = await callSessionAPI(
      { action: "switch", taskId, durations: durationsRef.current },
      headersRef.current
    );
    applyState(next);
  }, []);

  /** ข้าม task ปัจจุบัน → ไป task ถัดไปอัตโนมัติ */
  const handleSkip = useCallback(async () => {
    primeAudio();
    const next = await callSessionAPI(
      { action: "skip", durations: durationsRef.current },
      headersRef.current
    );
    applyState(next);
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
