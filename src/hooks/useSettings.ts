"use client";

import { useCallback, useEffect, useState } from "react";

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

const STORAGE_KEY = "pomodoro-settings";

export function useSettings() {
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS);

  // โหลดจาก localStorage ตอน mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as PomodoroSettings;
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch {
      // ถ้า parse ไม่ได้ ใช้ default
    }
  }, []);

  const updateSettings = useCallback((patch: Partial<PomodoroSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
