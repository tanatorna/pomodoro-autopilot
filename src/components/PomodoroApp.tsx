"use client";

import { useCallback, useEffect, useState } from "react";
import type { Task } from "@/generated/prisma/client";
import { usePomodoro } from "@/hooks/usePomodoro";
import { Timer } from "./Timer";
import { BrainDump } from "./BrainDump";
import { TaskList } from "./TaskList";
import { ScheduleView } from "./ScheduleView";
import { BacklogView } from "./BacklogView";
import { DaySummary } from "./DaySummary";
import { InterruptButton } from "./InterruptButton";
import { DURATIONS } from "@/engine";
import type { TimerState } from "@/engine";

interface SlotWithTask {
  id: number;
  slotIndex: number;
  status: string;
  task: Task;
}

type SidePanel = "tasks" | "schedule" | "backlog";

const PANEL_LABELS: Record<SidePanel, string> = {
  tasks: "Tasks",
  schedule: "Schedule",
  backlog: "Backlog",
};

export function PomodoroApp() {
  const {
    timerState, display, remainingMs, loading,
    handleStart, handlePause, handleResume, handleRestart,
  } = usePomodoro();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [slots, setSlots] = useState<SlotWithTask[]>([]);
  const [backlog, setBacklog] = useState<Task[]>([]);
  const [panel, setPanel] = useState<SidePanel>("tasks");
  const [generating, setGenerating] = useState(false);
  const [endingDay, setEndingDay] = useState(false);

  // ─── Loaders ──────────────────────────────
  const loadTasks = useCallback(async () => {
    const res = await fetch("/api/tasks");
    setTasks((await res.json()) as Task[]);
  }, []);

  const loadSchedule = useCallback(async () => {
    const res = await fetch("/api/schedule");
    setSlots((await res.json()) as SlotWithTask[]);
  }, []);

  const loadBacklog = useCallback(async () => {
    const res = await fetch("/api/backlog");
    setBacklog((await res.json()) as Task[]);
  }, []);

  useEffect(() => {
    void loadTasks();
    void loadSchedule();
    void loadBacklog();
  }, [loadTasks, loadSchedule, loadBacklog]);

  // ─── Task actions ─────────────────────────
  async function handleAddTask(title: string) {
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    await loadTasks();
  }

  async function handleSelectAndStart(taskId: number) {
    await handleStart(taskId);
  }

  // ─── Schedule actions ─────────────────────
  async function handleGenerate() {
    setGenerating(true);
    await fetch("/api/schedule", { method: "POST" });
    await loadSchedule();
    setGenerating(false);
    setPanel("schedule");
  }

  async function handlePriorityUp(taskId: number, current: number) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: current + 1 }),
    });
    await loadTasks();
    await fetch("/api/schedule", { method: "POST" });
    await loadSchedule();
  }

  async function handlePriorityDown(taskId: number, current: number) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: Math.max(0, current - 1) }),
    });
    await loadTasks();
    await fetch("/api/schedule", { method: "POST" });
    await loadSchedule();
  }

  // ─── Backlog actions ──────────────────────
  async function handleMoveToActive(taskId: number) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pending" }),
    });
    await loadTasks();
    await loadBacklog();
  }

  // ─── End of day ───────────────────────────
  async function handleEndDay() {
    setEndingDay(true);
    await fetch("/api/backlog", { method: "POST" });
    await Promise.all([loadTasks(), loadSchedule(), loadBacklog()]);
    setEndingDay(false);
    setPanel("backlog");
    window.location.reload();
  }

  // ─── Interrupt ────────────────────────────
  async function handleInterrupt(title: string) {
    await fetch("/api/interrupt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    window.location.reload();
  }

  // ─── Derived ──────────────────────────────
  const totalMs =
    timerState.state === "SHORT_BREAK"
      ? DURATIONS.SHORT_BREAK
      : timerState.state === "LONG_BREAK"
        ? DURATIONS.LONG_BREAK
        : DURATIONS.WORK;

  const pendingCount = tasks.filter(
    (t) => t.status === "pending" || t.status === "in-progress"
  ).length;

  return (
    <div className="min-h-screen bg-[#111] text-white flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-200">
          🍅 Pomodoro Autopilot
        </h1>
        <span className="text-xs text-zinc-600">
          {timerState.completedPomodoros > 0 &&
            `${timerState.completedPomodoros} 🍅 วันนี้`}
        </span>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar */}
        <aside className="w-80 border-r border-zinc-800 flex flex-col overflow-hidden">

          {/* Tab switcher */}
          <div className="flex border-b border-zinc-800 shrink-0">
            {(["tasks", "schedule", "backlog"] as SidePanel[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setPanel(tab)}
                className={`flex-1 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors
                  ${panel === tab
                    ? "text-amber-400 border-b-2 border-amber-400"
                    : "text-zinc-500 hover:text-zinc-300"
                  }`}
              >
                {PANEL_LABELS[tab]}
                {tab === "backlog" && backlog.length > 0 && (
                  <span className="ml-1 bg-zinc-700 text-zinc-400 rounded-full px-1.5 text-xs">
                    {backlog.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {panel === "tasks" && (
              <>
                <BrainDump onAdd={handleAddTask} />
                <TaskList
                  tasks={tasks}
                  currentTaskId={timerState.currentTaskId}
                  onSelect={handleSelectAndStart}
                />
                {/* Day summary ใน tasks panel */}
                <DaySummary
                  completedPomodoros={timerState.completedPomodoros}
                  pendingCount={pendingCount}
                  onEndDay={handleEndDay}
                  ending={endingDay}
                />
              </>
            )}

            {panel === "schedule" && (
              <ScheduleView
                slots={slots}
                currentTaskId={timerState.currentTaskId}
                onGenerate={handleGenerate}
                onPriorityUp={handlePriorityUp}
                onPriorityDown={handlePriorityDown}
                generating={generating}
              />
            )}

            {panel === "backlog" && (
              <BacklogView
                tasks={backlog}
                onMoveToActive={handleMoveToActive}
              />
            )}
          </div>
        </aside>

        {/* Center: Timer */}
        <main className="flex-1 flex items-center justify-center">
          <Timer
            timerState={timerState}
            display={display}
            remainingMs={remainingMs}
            totalMs={totalMs}
            loading={loading}
            onStart={() => handleStart()}
            onPause={handlePause}
            onResume={handleResume}
            onRestart={handleRestart}
          />
        </main>
      </div>

      {/* Interrupt button */}
      <InterruptButton
        visible={timerState.state === "WORK" || timerState.state === "PAUSED"}
        onInterrupt={handleInterrupt}
      />
    </div>
  );
}
