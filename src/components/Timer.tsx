"use client";

import type { TimerState } from "@/engine";

interface TimerProps {
  timerState: TimerState;
  display: string;
  remainingMs: number;
  totalMs: number;
  loading: boolean;
  currentTaskTitle?: string | null;
  perLong?: number; // pomodoro dots ต่อรอบ long break (default 4)
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
}

const LABELS: Record<TimerState["state"], string> = {
  IDLE: "พร้อมเริ่ม",
  WORK: "โฟกัส",
  SHORT_BREAK: "พักสั้น",
  LONG_BREAK: "พักยาว",
  PAUSED: "หยุดพัก",
};

// สีตาม state (Ember): WORK=terracotta, short=sage, long=teal, idle/paused=muted
function stateColor(state: TimerState["state"]): string {
  if (state === "WORK") return "var(--primary)";
  if (state === "SHORT_BREAK") return "var(--success)";
  if (state === "LONG_BREAK") return "var(--break-long)";
  return "var(--muted-foreground)";
}

function fmt(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const SIZE = 230;
const R = 46;
const C = 2 * Math.PI * R;

export function Timer({
  timerState,
  display,
  remainingMs,
  totalMs,
  loading,
  currentTaskTitle,
  perLong = 4,
  onStart,
  onPause,
  onResume,
  onRestart,
}: TimerProps) {
  const state = timerState.state;
  const color = stateColor(state);
  const isPaused = state === "PAUSED";
  const isBreak = state === "SHORT_BREAK" || state === "LONG_BREAK";
  const isRunningish = state === "WORK" || isBreak || isPaused;

  // IDLE → โชว์เวลาเต็ม (เช่น 25:00) · ระหว่างเดิน → วงแหวน "เดินหน้า" เติมเต็มตามเวลาที่ผ่านไป
  const showFullIdle = state === "IDLE";
  // fill = สัดส่วนเวลาที่ผ่านไป (0 ตอนเริ่ม → 1 ตอนหมดเวลา) · IDLE = ว่าง
  const fill = totalMs > 0 && !showFullIdle ? 1 - remainingMs / totalMs : 0;
  const digits = loading ? "--:--" : showFullIdle ? fmt(totalMs) : display;

  const dots = ((timerState.completedPomodoros % perLong) + perLong) % perLong;

  return (
    <div
      className="flex flex-col items-center gap-6 select-none text-center"
      style={{ textShadow: "0 1px 12px rgba(255,249,241,0.8)" }}
    >
      {/* State badge — outline italic (Newsreader) */}
      <span
        className="inline-flex items-center rounded-full px-4 py-1.5 text-[15px] italic"
        style={{
          fontFamily: "var(--font-heading)",
          border: `1.5px solid ${color}`,
          color,
        }}
      >
        {LABELS[state]}
      </span>

      {/* Task line */}
      <div className="min-h-[22px]">
        {currentTaskTitle && (state === "WORK" || isPaused) ? (
          <p className="text-sm text-muted-foreground max-w-xs">
            กำลังทำ · <span className="font-semibold text-foreground">{currentTaskTitle}</span>
          </p>
        ) : state === "IDLE" ? (
          <p className="text-sm text-muted-foreground">กดเริ่มเพื่อโฟกัส task แรกในคิว</p>
        ) : isBreak ? (
          <p className="text-sm text-muted-foreground">พักสายตา เดี๋ยวระบบเริ่มงานถัดไปให้เอง</p>
        ) : null}
      </div>

      {/* Ring + digits */}
      <div
        className="relative flex items-center justify-center transition-opacity"
        style={{ width: SIZE, height: SIZE, opacity: isPaused ? 0.6 : 1 }}
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--ring-track)" strokeWidth={6} />
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke={color}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - fill)}
            style={{ transition: "stroke-dashoffset 1s linear, stroke .3s" }}
          />
        </svg>
        <div className="flex flex-col items-center z-10">
          <span
            className="text-foreground leading-none"
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 500,
              fontSize: 56,
              fontVariantNumeric: "tabular-nums",
              textShadow: "0 2px 20px rgba(255,249,241,0.85)",
            }}
          >
            {digits}
          </span>
          {(state === "WORK" || isPaused) && (
            <div className="flex gap-1.5 mt-3">
              {Array.from({ length: perLong }).map((_, i) => (
                <span
                  key={i}
                  className="w-[7px] h-[7px] rounded-full transition-colors"
                  style={{ background: i < dots ? color : "var(--ring-track)" }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2.5">
        {state === "IDLE" && (
          <button
            onClick={onStart}
            className="rounded-xl bg-primary px-[30px] py-3 text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--accent-hover)] active:translate-y-px"
          >
            เริ่มโฟกัส
          </button>
        )}

        {isRunningish && !isPaused && (
          <button
            onClick={onPause}
            className="rounded-xl bg-card border border-[var(--border-strong)] px-6 py-3 text-[15px] font-semibold text-[var(--ink-soft)] transition-colors hover:bg-secondary active:translate-y-px"
          >
            หยุดชั่วคราว
          </button>
        )}

        {isPaused && (
          <button
            onClick={onResume}
            className="rounded-xl bg-primary px-[30px] py-3 text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--accent-hover)] active:translate-y-px"
          >
            เดินต่อ
          </button>
        )}

        {isRunningish && (
          <button
            onClick={onRestart}
            className="rounded-xl px-4 py-3 text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground active:translate-y-px"
          >
            เริ่มใหม่
          </button>
        )}
      </div>
    </div>
  );
}
