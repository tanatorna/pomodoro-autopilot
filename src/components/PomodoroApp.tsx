"use client";

import { useCallback, useEffect, useState } from "react";
import type { Task } from "@/generated/prisma/client";
import { usePomodoro } from "@/hooks/usePomodoro";
import { useSettings } from "@/hooks/useSettings";
import { useRoom } from "@/hooks/useRoom";
import { useSession } from "next-auth/react";
import { AccountButton } from "./AccountButton";
import { Timer } from "./Timer";
import { ScheduleMain } from "./ScheduleMain";
import { BacklogView } from "./BacklogView";
import { SettingsPanel } from "./SettingsPanel";
import { InterruptButton } from "./InterruptButton";
import { RoomBadge } from "./RoomBadge";

type SidePanel = "schedule" | "backlog" | "settings";

const PANEL_LABELS: Record<SidePanel, string> = {
  schedule: "Schedule",
  backlog: "Backlog",
  settings: "⚙️",
};

export function PomodoroApp() {
  const { settings, durations, updateSettings } = useSettings();
  const { roomId, setRoom, createRoom, renameRoom, checkRoom, deleteRoom, roomHeaders } = useRoom();

  // ── optional sign-in: ถ้าล็อกอินแล้วบัญชีผูกห้องไว้ → สลับไปห้องนั้น ──
  const { data: session } = useSession();
  const accountRoom = session?.user?.roomId ?? null;
  useEffect(() => {
    if (accountRoom && roomId && accountRoom !== roomId) {
      setRoom(accountRoom); // reload ไปห้องของบัญชี
    }
  }, [accountRoom, roomId, setRoom]);
  const {
    timerState, display, remainingMs, loading,
    handleStart, handlePause, handleResume, handleRestart,
  } = usePomodoro(durations, roomHeaders);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [backlog, setBacklog] = useState<Task[]>([]);
  const [panel, setPanel] = useState<SidePanel>("schedule");
  const [endingDay, setEndingDay] = useState(false);

  // ─── Loaders ──────────────────────────────
  const loadTasks = useCallback(async () => {
    if (!roomId) return;
    const res = await fetch("/api/tasks", { headers: roomHeaders });
    setTasks((await res.json()) as Task[]);
  }, [roomId, roomHeaders]);

  const loadBacklog = useCallback(async () => {
    if (!roomId) return;
    const res = await fetch("/api/backlog", { headers: roomHeaders });
    setBacklog((await res.json()) as Task[]);
  }, [roomId, roomHeaders]);

  const generateSchedule = useCallback(async () => {
    if (!roomId) return;
    await fetch("/api/schedule", { method: "POST", headers: roomHeaders });
  }, [roomId, roomHeaders]);

  useEffect(() => {
    if (!roomId) return;
    void loadTasks();
    void loadBacklog();
  }, [roomId, loadTasks, loadBacklog]);

  // ─── Task actions ─────────────────────────
  async function handleAddTask(title: string, estimatedPomodoros: number) {
    await fetch("/api/tasks", {
      method: "POST",
      headers: roomHeaders,
      body: JSON.stringify({ title, estimatedPomodoros, status: "pending" }),
    });
    await loadTasks();
    await generateSchedule();
  }

  async function handleAddToBacklog(title: string, estimatedPomodoros: number) {
    await fetch("/api/tasks", {
      method: "POST",
      headers: roomHeaders,
      body: JSON.stringify({ title, estimatedPomodoros, status: "backlog" }),
    });
    await loadBacklog();
  }

  async function handleSelectAndStart(taskId: number) {
    await handleStart(taskId);
  }

  /** แก้ชื่อ task (เช่น พิมพ์ผิด) */
  async function handleEditTask(taskId: number, title: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: roomHeaders,
      body: JSON.stringify({ title }),
    });
    await loadTasks();
  }

  /** ลบ task ทิ้ง */
  async function handleDeleteTask(taskId: number) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "DELETE",
      headers: roomHeaders,
    });
    await loadTasks();
    await generateSchedule();
  }

  async function handlePriorityUp(taskId: number, current: number) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: roomHeaders,
      body: JSON.stringify({ priority: current + 1 }),
    });
    await loadTasks();
    await generateSchedule();
  }

  async function handlePriorityDown(taskId: number, current: number) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: roomHeaders,
      body: JSON.stringify({ priority: Math.max(0, current - 1) }),
    });
    await loadTasks();
    await generateSchedule();
  }

  // ─── Backlog ──────────────────────────────
  async function handleMoveToActive(taskId: number) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: roomHeaders,
      body: JSON.stringify({ status: "pending" }),
    });
    await loadTasks();
    await loadBacklog();
    await generateSchedule();
  }

  // ─── End of day ───────────────────────────
  async function handleEndDay() {
    setEndingDay(true);
    await fetch("/api/backlog", { method: "POST", headers: roomHeaders });
    await Promise.all([loadTasks(), loadBacklog()]);
    setEndingDay(false);
    setPanel("backlog");
    window.location.reload();
  }

  // ─── Interrupt ────────────────────────────
  async function handleInterrupt(title: string) {
    await fetch("/api/interrupt", {
      method: "POST",
      headers: roomHeaders,
      body: JSON.stringify({ title }),
    });
    window.location.reload();
  }

  // ─── Derived ──────────────────────────────
  const totalMs =
    timerState.state === "SHORT_BREAK"
      ? durations.SHORT_BREAK
      : timerState.state === "LONG_BREAK"
        ? durations.LONG_BREAK
        : durations.WORK;

  const pendingCount = tasks.filter(
    (t) => t.status === "pending" || t.status === "in-progress"
  ).length;

  const currentTask =
    tasks.find((t) => t.id === timerState.currentTaskId) ?? null;

  return (
    <div className="min-h-screen dusk-bg text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="px-4 sm:px-6 py-3 flex items-center justify-between gap-2 shrink-0 border-b border-white/10 glass">
        <h1 className="text-base md:text-lg font-semibold text-zinc-100 whitespace-nowrap">
          🍅 Pomodoro<span className="hidden sm:inline"> Autopilot</span>
        </h1>
        <div className="flex items-center gap-2 shrink-0">
          <RoomBadge
            roomId={roomId}
            onChangeRoom={setRoom}
            onCreateRoom={createRoom}
            onRenameRoom={renameRoom}
            onCheckRoom={checkRoom}
            onDeleteRoom={deleteRoom}
          />
          <AccountButton roomId={roomId} roomHeaders={roomHeaders} />
        </div>
      </header>

      {/* Main area: มือถือ stack แนวตั้ง (timer บน) · desktop เป็น 2 คอลัมน์ (panel ซ้าย, timer กลาง) */}
      <div className="flex flex-1 flex-col md:flex-row md:overflow-hidden">

        {/* Timer (hero) */}
        <main className="order-1 md:order-2 md:flex-1 flex items-center justify-center px-4 py-10 md:py-0">
          <Timer
            timerState={timerState}
            display={display}
            remainingMs={remainingMs}
            totalMs={totalMs}
            loading={loading}
            currentTaskTitle={currentTask?.title ?? null}
            onStart={() => handleStart()}
            onPause={handlePause}
            onResume={handleResume}
            onRestart={handleRestart}
          />
        </main>

        {/* Panel (มือถือ: ใต้ timer / desktop: sidebar ซ้าย) */}
        <aside className="order-2 md:order-1 w-full md:w-80 shrink-0 flex flex-col border-t md:border-t-0 md:border-r border-white/10 glass md:overflow-hidden">

          {/* Tab switcher */}
          <div className="flex border-b border-white/10 shrink-0">
            {(["schedule", "backlog", "settings"] as SidePanel[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setPanel(tab)}
                className={`flex-1 py-3 text-xs font-medium uppercase tracking-wider transition-colors
                  ${panel === tab
                    ? "text-amber-300 border-b-2 border-amber-300"
                    : "text-zinc-400 hover:text-zinc-200"
                  }`}
              >
                {PANEL_LABELS[tab]}
                {tab === "backlog" && backlog.length > 0 && (
                  <span className="ml-1 bg-white/10 text-zinc-200 rounded-full px-1.5 text-xs">
                    {backlog.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex-1 md:overflow-y-auto p-4">
            {panel === "schedule" && (
              <ScheduleMain
                tasks={tasks}
                currentTaskId={timerState.currentTaskId}
                completedPomodoros={timerState.completedPomodoros}
                pendingCount={pendingCount}
                onAdd={handleAddTask}
                onSelect={handleSelectAndStart}
                onPriorityUp={handlePriorityUp}
                onPriorityDown={handlePriorityDown}
                onEdit={handleEditTask}
                onDelete={handleDeleteTask}
                onEndDay={handleEndDay}
                endingDay={endingDay}
              />
            )}

            {panel === "backlog" && (
              <BacklogView
                tasks={backlog}
                onAdd={handleAddToBacklog}
                onMoveToActive={handleMoveToActive}
              />
            )}

            {panel === "settings" && (
              <SettingsPanel
                settings={settings}
                onChange={updateSettings}
              />
            )}
          </div>
        </aside>
      </div>

      {/* Interrupt button */}
      <InterruptButton
        visible={timerState.state === "WORK" || timerState.state === "PAUSED"}
        onInterrupt={handleInterrupt}
      />
    </div>
  );
}
