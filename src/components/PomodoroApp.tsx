"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  settings: "Setting",
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
    handleSwitchTask, handleSkip, refresh,
  } = usePomodoro(durations, roomHeaders);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [backlog, setBacklog] = useState<Task[]>([]);
  const [panel, setPanel] = useState<SidePanel>("schedule");
  const [endingDay, setEndingDay] = useState(false);

  // ── confirm dialog สำหรับ switch/skip ──
  // kind=switch: เปลี่ยนไป task ใหม่ที่ระบุ · kind=skip: ข้ามไป task ถัดไปอัตโนมัติ
  const [pendingSwitch, setPendingSwitch] = useState<
    { kind: "switch"; toId: number; toTitle: string } | { kind: "skip" } | null
  >(null);

  // ── toast (feedback แทน reload) ──
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

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
    const running =
      timerState.state === "WORK" ||
      timerState.state === "PAUSED" ||
      timerState.state === "SHORT_BREAK" ||
      timerState.state === "LONG_BREAK";

    // ถ้า running อยู่และเลือก task อื่น → ขอ confirm switch (ลูกปัจจุบันจะไม่นับ)
    if (running && taskId !== timerState.currentTaskId) {
      const target = tasks.find((t) => t.id === taskId);
      setPendingSwitch({ kind: "switch", toId: taskId, toTitle: target?.title ?? "task" });
      return;
    }
    await handleStart(taskId);
  }

  async function confirmSwitchOrSkip() {
    if (!pendingSwitch) return;
    if (pendingSwitch.kind === "switch") {
      await handleSwitchTask(pendingSwitch.toId);
      await loadTasks();
      showToast(`🔀 เปลี่ยนเป็น “${pendingSwitch.toTitle}”`);
    } else {
      const currentTitle = currentTask?.title ?? "task";
      await handleSkip();
      await loadTasks();
      showToast(`⏭ ข้าม “${currentTitle}”`);
    }
    setPendingSwitch(null);
  }

  /** แก้ task — ชื่อ และ/หรือ จำนวน 🍅 */
  async function handleEditTask(
    taskId: number,
    patch: { title?: string; estimatedPomodoros?: number }
  ) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: roomHeaders,
      body: JSON.stringify(patch),
    });
    await loadTasks();
    // ถ้าจำนวน 🍅 เปลี่ยน อาจกระทบ schedule slots → regenerate
    if (patch.estimatedPomodoros !== undefined) await generateSchedule();
  }

  /** ย้าย task จาก Schedule ไป Backlog (ไม่ทำวันนี้แล้ว) — เคลียร์วันที่ปักไว้ */
  async function handleMoveToBacklog(taskId: number) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: roomHeaders,
      body: JSON.stringify({ status: "backlog", scheduledFor: null }),
    });
    await Promise.all([loadTasks(), loadBacklog(), generateSchedule()]);
    const t = tasks.find((x) => x.id === taskId);
    showToast(`📥 ย้าย “${t?.title ?? "task"}” ไป Backlog`);
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

  /** ปักวัน / เคลียร์วันให้ task ใน backlog */
  async function handleScheduleTask(taskId: number, isoDate: string | null) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: roomHeaders,
      body: JSON.stringify({ scheduledFor: isoDate }),
    });
    // ถ้าใส่วันที่ ≤ วันนี้ → API จะ auto-promote ตอน fetch ครั้งหน้า
    await Promise.all([loadTasks(), loadBacklog()]);
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
    const res = await fetch("/api/backlog", { method: "POST", headers: roomHeaders });
    const data = (await res.json().catch(() => null)) as
      | { summary?: { movedToBacklog?: number } }
      | null;
    await Promise.all([loadTasks(), loadBacklog(), refresh()]); // re-fetch แทน reload (จอไม่กระพริบ)
    setEndingDay(false);
    setPanel("backlog");
    const moved = data?.summary?.movedToBacklog;
    showToast(
      `🌙 จบวันแล้ว${typeof moved === "number" ? ` — ย้าย ${moved} task ไป Backlog` : ""}`
    );
  }

  // ─── Interrupt ────────────────────────────
  async function handleInterrupt(title: string) {
    await fetch("/api/interrupt", {
      method: "POST",
      headers: roomHeaders,
      body: JSON.stringify({ title }),
    });
    await Promise.all([loadTasks(), generateSchedule(), refresh()]); // re-fetch แทน reload
    showToast(`⚡ แทรกงานด่วน — ${title}`);
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

  // Pending tasks เรียง priority สูง→ต่ำ → id (ให้ Timer ใช้ preview/picker ตอน IDLE)
  const pendingTasks = tasks
    .filter((t) => t.status === "pending" || t.status === "in-progress")
    .sort((a, b) =>
      b.priority !== a.priority ? b.priority - a.priority : a.id - b.id
    );

  return (
    <div className="min-h-screen ember-bg text-foreground relative flex flex-col md:grid md:grid-cols-[3fr_2fr] md:h-screen">
      {/* Logo — ลอยมุมซ้ายบน กลืนกับพื้นหลัง */}
      <h1
        className="absolute top-0 left-0 h-14 flex items-center px-4 sm:px-6 z-30 text-lg font-semibold text-foreground whitespace-nowrap"
        style={{ fontFamily: "var(--font-heading), var(--font-sans), system-ui, sans-serif", textShadow: "0 1px 14px rgba(255,248,240,0.75)" }}
      >
        🍅 Pomodachi
      </h1>

      {/* Timer (hero) — ฝั่งซ้าย 60% · ลอยบนรูปตรงๆ */}
      <main className="relative flex items-center justify-center p-5 sm:p-8 pt-16 md:pt-8 order-1">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(closest-side at 50% 46%, rgba(255,249,241,0.6), rgba(255,249,241,0) 72%)",
          }}
        />
        <div className="relative">
          <Timer
            timerState={timerState}
            display={display}
            remainingMs={remainingMs}
            totalMs={totalMs}
            loading={loading}
            currentTaskTitle={currentTask?.title ?? null}
            perLong={durations.POMODOROS_PER_LONG_BREAK}
            pendingTasks={pendingTasks}
            onStart={(taskId) => handleStart(taskId)}
            onPause={handlePause}
            onResume={handleResume}
            onRestart={handleRestart}
            onSkip={() => setPendingSwitch({ kind: "skip" })}
          />
        </div>
      </main>

      {/* Panel — ฝั่งขวา 40% · กระจกเต็มความสูงถึงขอบบน
          NOTE: ห้ามใส่ overflow-hidden ที่นี่ — dropdown (room/account) ใช้ absolute
          กับ position ของปุ่ม → ล้นซ้ายเลย panel · ให้ scroll control อยู่ใน content div ข้างใน */}
      <aside className="paper-panel order-2 flex flex-col border-t md:border-t-0 md:border-l border-border min-h-[56vh] md:min-h-0 md:h-full">

        {/* Controls (room + account) — หัว panel */}
        <div className="flex items-center justify-end gap-2 px-4 h-14 shrink-0">
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

          {/* Tab switcher */}
          <div className="flex border-b border-border shrink-0">
            {(["schedule", "backlog", "settings"] as SidePanel[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setPanel(tab)}
                className={`flex-1 py-3.5 text-sm font-medium transition-colors
                  ${panel === tab
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                {PANEL_LABELS[tab]}
                {tab === "backlog" && backlog.length > 0 && (
                  <span className="ml-1.5 bg-primary/15 text-primary rounded-full px-1.5 text-xs font-semibold">
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
                onMoveToBacklog={handleMoveToBacklog}
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
                onScheduleTask={handleScheduleTask}
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

      {/* Interrupt button */}
      <InterruptButton
        visible={timerState.state === "WORK" || timerState.state === "PAUSED"}
        onInterrupt={handleInterrupt}
      />

      {/* Confirm switch / skip */}
      {pendingSwitch && (
        <>
          <div className="fixed inset-0 z-[55] bg-black/30" onClick={() => setPendingSwitch(null)} />
          <div
            className="paper-panel pm-pop fixed left-1/2 top-1/2 z-[60] -translate-x-1/2 -translate-y-1/2
              border border-border rounded-2xl p-5 w-[min(420px,90vw)]"
            style={{ boxShadow: "0 24px 70px rgba(40,28,18,0.28)" }}
          >
            <p className="text-base font-semibold text-foreground mb-1.5">
              {pendingSwitch.kind === "switch"
                ? `เปลี่ยนไปทำ “${pendingSwitch.toTitle}”?`
                : `ข้าม “${currentTask?.title ?? "task นี้"}”?`}
            </p>
            <p className="text-sm text-[var(--ink-soft)] mb-4">
              ลูก Pomodoro ของ <strong>{currentTask?.title ?? "task ปัจจุบัน"}</strong> ที่ทำค้างอยู่
              <strong> จะไม่ถูกนับ</strong> (เริ่มลูกใหม่ที่ 25:00)
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPendingSwitch(null)}
                className="px-4 py-2 rounded-lg text-sm text-[var(--ink-soft)] hover:bg-secondary"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmSwitchOrSkip}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-[var(--accent-hover)] text-primary-foreground text-sm font-semibold"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </>
      )}

      {/* Toast (feedback) */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] pm-toast">
          <div
            className="paper-panel border border-border rounded-xl px-4 py-2.5 text-sm text-foreground"
            style={{ boxShadow: "0 14px 40px rgba(120,80,40,0.16)" }}
          >
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
