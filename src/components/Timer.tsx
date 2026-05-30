"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TimerState } from "@/engine";

interface TimerProps {
  timerState: TimerState;
  display: string;
  remainingMs: number;
  totalMs: number;
  loading: boolean;
  currentTaskTitle?: string | null;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
}

const STATE_LABELS: Record<TimerState["state"], string> = {
  IDLE: "พร้อมเริ่ม",
  WORK: "โฟกัส 🍅",
  SHORT_BREAK: "พักสั้น ☕",
  LONG_BREAK: "พักยาว 🛋️",
  PAUSED: "หยุดพัก ⏸",
};

const STATE_COLORS: Record<TimerState["state"], string> = {
  IDLE: "bg-zinc-700 text-zinc-300",
  WORK: "bg-amber-500/20 text-amber-400",
  SHORT_BREAK: "bg-emerald-500/20 text-emerald-400",
  LONG_BREAK: "bg-sky-500/20 text-sky-400",
  PAUSED: "bg-zinc-600/20 text-zinc-400",
};

export function Timer({
  timerState,
  display,
  remainingMs,
  totalMs,
  loading,
  currentTaskTitle,
  onStart,
  onPause,
  onResume,
  onRestart,
}: TimerProps) {
  const progress = totalMs > 0 ? (remainingMs / totalMs) * 100 : 0;

  // โชว์ชื่อ task ที่กำลังทำ เฉพาะตอนโฟกัส/พักชั่วคราว
  const showTask =
    currentTaskTitle &&
    (timerState.state === "WORK" || timerState.state === "PAUSED");

  return (
    <div className="flex flex-col items-center gap-6 select-none">
      {/* State badge */}
      <Badge className={`px-4 py-1 text-sm font-medium rounded-full border-0 ${STATE_COLORS[timerState.state]}`}>
        {STATE_LABELS[timerState.state]}
      </Badge>

      {/* ชื่อ task ที่กำลังทำ */}
      {showTask && (
        <p className="-mt-3 max-w-xs text-center text-sm text-zinc-400 truncate">
          กำลังทำ: <span className="font-medium text-zinc-100">{currentTaskTitle}</span>
        </p>
      )}

      {/* Countdown */}
      <div className="relative flex items-center justify-center w-64 h-64">
        {/* Progress ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#27272a" strokeWidth="4" />
          <circle
            cx="50" cy="50" r="45"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 45}`}
            strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>

        {/* Time display */}
        <div className="flex flex-col items-center z-10">
          <span className="text-6xl font-mono font-bold text-white tracking-tight">
            {loading ? "--:--" : display}
          </span>
          {timerState.completedPomodoros > 0 && (
            <span className="text-xs text-zinc-500 mt-1">
              {"🍅".repeat(Math.min(timerState.completedPomodoros, 8))}
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        {timerState.state === "IDLE" && (
          <Button
            onClick={onStart}
            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-8"
          >
            เริ่ม
          </Button>
        )}

        {(timerState.state === "WORK" ||
          timerState.state === "SHORT_BREAK" ||
          timerState.state === "LONG_BREAK") && (
          <>
            <Button
              onClick={onPause}
              variant="outline"
              className="border-zinc-600 text-zinc-300 hover:bg-zinc-800"
            >
              หยุดชั่วคราว
            </Button>
            <Button
              onClick={onRestart}
              variant="ghost"
              className="text-zinc-500 hover:text-zinc-300"
            >
              เริ่มใหม่
            </Button>
          </>
        )}

        {timerState.state === "PAUSED" && (
          <>
            <Button
              onClick={onResume}
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-8"
            >
              เดินต่อ
            </Button>
            <Button
              onClick={onRestart}
              variant="ghost"
              className="text-zinc-500 hover:text-zinc-300"
            >
              เริ่มใหม่
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
