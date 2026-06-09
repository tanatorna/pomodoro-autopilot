"use client";

import { useEffect, useState } from "react";
import type { Task } from "@/generated/prisma/client";
import type { TimerState } from "@/engine";

interface TimerProps {
  timerState: TimerState;
  display: string;
  remainingMs: number;
  totalMs: number;
  loading: boolean;
  currentTaskTitle?: string | null;
  perLong?: number; // pomodoro dots ต่อรอบ long break (default 4)
  /** Task ที่ pending อยู่ — สำหรับ preview "task ถัดไป" + dropdown เปลี่ยน (IDLE state) */
  pendingTasks?: Task[];
  onStart: (taskId?: number) => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  /** ข้าม task ปัจจุบัน → ไป task ถัดไปอัตโนมัติ (โผล่ตอน WORK/PAUSED) */
  onSkip?: () => void;
  /** จบ task ปัจจุบันก่อนเวลา (นับลูกนี้ให้ task นี้ + ทำต่อในเวลาที่เหลือ) */
  onFinishEarly?: () => void;
}

const LABELS: Record<TimerState["state"], string> = {
  IDLE: "พร้อมเริ่ม",
  WORK: "โฟกัส",
  SHORT_BREAK: "พักสั้น",
  LONG_BREAK: "พักยาว",
  PAUSED: "หยุดพัก",
};

// สีตาม state (Ember): WORK=terracotta, short=sage, long=teal, idle/paused=ink เข้มอ่อน
function stateColor(state: TimerState["state"]): string {
  if (state === "WORK") return "var(--primary)";
  if (state === "SHORT_BREAK") return "var(--success)";
  if (state === "LONG_BREAK") return "var(--break-long)";
  return "var(--ink-soft)"; // เดิม muted-foreground จางเกินบนรูปพื้นหลัง
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
  pendingTasks = [],
  onStart,
  onPause,
  onResume,
  onRestart,
  onSkip,
  onFinishEarly,
}: TimerProps) {
  const state = timerState.state;
  const color = stateColor(state);
  const isPaused = state === "PAUSED";
  const isBreak = state === "SHORT_BREAK" || state === "LONG_BREAK";
  const isRunningish = state === "WORK" || isBreak || isPaused;

  // ── IDLE: เลือก task ที่จะเริ่มด้วย (default = task แรกในคิว) ──
  // value: number = id, null = "ไม่ผูก task"
  const firstPendingId = pendingTasks[0]?.id ?? null;
  const [selectedId, setSelectedId] = useState<number | null>(firstPendingId);
  const [pickerOpen, setPickerOpen] = useState(false);
  // sync เมื่อคิวเปลี่ยน (เพิ่ม/ลบ task) และ user ยังไม่ได้เลือกเอง
  useEffect(() => {
    setSelectedId((prev) =>
      prev !== null && pendingTasks.some((t) => t.id === prev) ? prev : firstPendingId
    );
  }, [firstPendingId, pendingTasks]);
  const selectedTask = pendingTasks.find((t) => t.id === selectedId) ?? null;

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
          fontFamily: "var(--font-heading), var(--font-sans), system-ui, sans-serif",
          border: `1.5px solid ${color}`,
          color,
        }}
      >
        {LABELS[state]}
      </span>

      {/* Task line / preview */}
      <div className="min-h-[22px] relative z-30">
        {currentTaskTitle && (state === "WORK" || isPaused) ? (
          <p className="text-sm text-[var(--ink-soft)] max-w-xs">
            กำลังทำ · <span className="font-semibold text-foreground">{currentTaskTitle}</span>
          </p>
        ) : state === "IDLE" ? (
          pendingTasks.length === 0 ? (
            <p className="text-sm font-medium text-[var(--ink-soft)]">
              ยังไม่มี task ในคิว — เพิ่ม task ทางด้านขวา
            </p>
          ) : (
            <p className="text-sm font-medium text-[var(--ink-soft)]">
              ถัดไป ·{" "}
              <span className="text-foreground font-semibold">
                {selectedTask?.title ?? "ไม่ผูก task"}
              </span>{" "}
              <button
                type="button"
                onClick={() => setPickerOpen((o) => !o)}
                className="ml-1 underline decoration-dotted text-primary hover:text-[var(--accent-hover)]"
              >
                เปลี่ยน
              </button>
            </p>
          )
        ) : isBreak ? (
          <p className="text-sm text-[var(--ink-soft)]">พักสายตา เดี๋ยวระบบเริ่มงานถัดไปให้เอง</p>
        ) : null}

        {/* Picker dropdown — IDLE เท่านั้น */}
        {state === "IDLE" && pickerOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
            <div
              className="pm-pop absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50
                border border-border rounded-xl w-72 max-h-72 overflow-y-auto py-1 text-left"
              style={{
                background: "rgba(255, 252, 246, 0.96)",
                backdropFilter: "blur(22px) saturate(140%)",
                WebkitBackdropFilter: "blur(22px) saturate(140%)",
                boxShadow: "0 14px 40px rgba(120,80,40,0.22)",
              }}
            >
              {pendingTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedId(t.id);
                    setPickerOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary flex items-center gap-2
                    ${t.id === selectedId ? "text-primary font-semibold" : "text-foreground"}`}
                >
                  <span className="text-xs text-[var(--faint)] w-4 shrink-0">
                    {t.id === selectedId ? "✓" : ""}
                  </span>
                  <span className="flex-1 truncate">{t.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {t.completedPomodoros}/{t.estimatedPomodoros}🍅
                  </span>
                </button>
              ))}
              <div className="border-t border-border mt-1 pt-1">
                <button
                  onClick={() => {
                    setSelectedId(null);
                    setPickerOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary
                    ${selectedId === null ? "text-primary font-semibold" : "text-[var(--ink-soft)]"}`}
                >
                  — ไม่ผูก task —
                </button>
              </div>
            </div>
          </>
        )}
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
              fontFamily: "var(--font-heading), var(--font-sans), system-ui, sans-serif",
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
            onClick={() => onStart(selectedId ?? undefined)}
            className="rounded-xl bg-primary px-[30px] py-3 text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--accent-hover)] active:translate-y-px"
          >
            เริ่มโฟกัส
          </button>
        )}

        {isRunningish && !isPaused && (
          <button
            onClick={onPause}
            className="rounded-xl px-6 py-3 text-[15px] font-semibold text-[var(--ink-soft)] transition-colors active:translate-y-px
              bg-[rgba(255,252,246,0.4)] hover:bg-[rgba(255,252,246,0.62)]
              backdrop-blur-[18px] backdrop-saturate-[140%] border border-[rgba(255,255,255,0.45)]
              shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_6px_20px_rgba(120,80,40,0.12)]"
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

        {/* ปุ่มหลักที่ 2: เวลาเดินอยู่ (WORK) + มี task → "เสร็จ task นี้" · นอกนั้น (พัก/ต่อเวลา) → เริ่มใหม่ */}
        {state === "WORK" && onFinishEarly && timerState.currentTaskId !== null ? (
          <button
            onClick={onFinishEarly}
            className="rounded-xl px-6 py-3 text-[15px] font-semibold text-[var(--ink-soft)] transition-colors active:translate-y-px
              bg-[rgba(255,252,246,0.4)] hover:bg-[rgba(255,252,246,0.62)]
              backdrop-blur-[18px] backdrop-saturate-[140%] border border-[rgba(255,255,255,0.45)]
              shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_6px_20px_rgba(120,80,40,0.12)]"
            title="task นี้เสร็จแล้ว — นับลูกนี้ให้ + ทำต่อในเวลาที่เหลือ"
          >
            ✓ เสร็จ task นี้
          </button>
        ) : isRunningish ? (
          <button
            onClick={onRestart}
            className="rounded-xl px-4 py-3 text-[15px] font-medium text-[var(--ink-soft)] transition-colors hover:text-foreground active:translate-y-px"
          >
            เริ่มใหม่
          </button>
        ) : null}
      </div>

      {/* Secondary action — ข้าม task · พื้นกระจกเล็กๆ รองหลัง → อ่านได้ทุกพื้นหลัง */}
      {onSkip && (state === "WORK" || isPaused) && timerState.currentTaskId !== null && (
        <button
          onClick={onSkip}
          className="-mt-2 text-[11px] px-2.5 py-0.5 rounded-full backdrop-blur-sm transition-colors
            bg-[rgba(255,252,246,0.55)] hover:bg-[rgba(255,252,246,0.8)]
            text-[var(--ink-soft)] hover:text-foreground"
          style={{ textShadow: "none" }}
          title="ข้าม task นี้ไปทำตัวถัดไป"
        >
          ⏭ ข้าม task นี้
        </button>
      )}
    </div>
  );
}
