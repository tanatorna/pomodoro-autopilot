"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface PomodoroSettings {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  pomodorosPerLongBreak: number;
}

export const DEFAULT_SETTINGS: PomodoroSettings = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  pomodorosPerLongBreak: 4,
};

const STORAGE_KEY = "pomodoro-settings"; // cache เร็วตอน mount (กันกระพริบ) — source of truth = server ต่อห้อง

function pick(o: Partial<PomodoroSettings>): PomodoroSettings {
  return {
    workMinutes: o.workMinutes ?? DEFAULT_SETTINGS.workMinutes,
    shortBreakMinutes: o.shortBreakMinutes ?? DEFAULT_SETTINGS.shortBreakMinutes,
    longBreakMinutes: o.longBreakMinutes ?? DEFAULT_SETTINGS.longBreakMinutes,
    pomodorosPerLongBreak: o.pomodorosPerLongBreak ?? DEFAULT_SETTINGS.pomodorosPerLongBreak,
  };
}

/** settings ต่อห้อง — โหลด/บันทึกบน server (sync ข้าม device) · localStorage = cache แสดงทันที */
export function useSettings(
  roomHeaders: Record<string, string> = { "Content-Type": "application/json" }
) {
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS);
  const headersRef = useRef(roomHeaders);
  useEffect(() => { headersRef.current = roomHeaders; }, [roomHeaders]);

  // 1) แสดง cache จาก localStorage ทันที (กันกระพริบก่อน server ตอบ)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setSettings(pick(JSON.parse(saved)));
    } catch { /* ignore */ }
  }, []);

  // 2) โหลดค่าจริงจาก server เมื่อ room พร้อม (+ re-load เมื่อเปลี่ยนห้อง)
  const roomId = roomHeaders["X-Room-Id"];
  useEffect(() => {
    if (!roomId) return;
    fetch("/api/settings", { headers: headersRef.current })
      .then((r) => r.json())
      .then((s: Partial<PomodoroSettings>) => {
        const next = pick(s);
        setSettings(next);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      })
      .catch(() => { /* offline → ใช้ cache/default */ });
  }, [roomId]);

  const updateSettings = useCallback((patch: Partial<PomodoroSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      // บันทึกขึ้น server (sync ข้าม device) — best-effort
      void fetch("/api/settings", {
        method: "PATCH",
        headers: headersRef.current,
        body: JSON.stringify(patch),
      });
      return next;
    });
  }, []);

  // แปลง minutes → ms สำหรับส่งให้ engine
  const durations = {
    WORK: settings.workMinutes * 60 * 1000,
    SHORT_BREAK: settings.shortBreakMinutes * 60 * 1000,
    LONG_BREAK: settings.longBreakMinutes * 60 * 1000,
    POMODOROS_PER_LONG_BREAK: settings.pomodorosPerLongBreak,
  };

  return { settings, durations, updateSettings };
}
