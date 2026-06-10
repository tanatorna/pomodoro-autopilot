"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Task } from "@/generated/prisma/client";
import { usePomodoro } from "@/hooks/usePomodoro";
import { useSettings } from "@/hooks/useSettings";
import { formatTime } from "@/engine/timeMath";
import { useRoom } from "@/hooks/useRoom";
import { useSession } from "next-auth/react";
import { AccountButton } from "./AccountButton";
import { Timer } from "./Timer";
import { ScheduleMain } from "./ScheduleMain";
import { BacklogView } from "./BacklogView";
import { StatsView, type DayStat } from "./StatsView";
import { SettingsPanel } from "./SettingsPanel";
import { InterruptButton } from "./InterruptButton";
import { RoomBadge } from "./RoomBadge";

type SidePanel = "schedule" | "backlog" | "stats" | "settings";

const PANEL_LABELS: Record<SidePanel, string> = {
  schedule: "Schedule",
  backlog: "Backlog",
  stats: "Stats",
  settings: "Setting",
};

export function PomodoroApp() {
  const { roomId, setRoom, createRoom, renameRoom, checkRoom, deleteRoom, roomHeaders } = useRoom();
  const { settings, durations, updateSettings } = useSettings(roomHeaders);

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
    handleSwitchTask, handleSkip, handleFinishEarly, clampDuration, refresh, syncError, wakeLockActive,
  } = usePomodoro(durations, roomHeaders);

  // ถ้า phase ที่เดินอยู่ยาวเกิน duration ปัจจุบัน (เช่น break ถูกสร้างด้วย setting เก่า
  // ก่อน settings-sync) → หดให้ตรง setting · guard ด้วย endsAt กัน clamp ซ้ำ
  const clampedRef = useRef<number | null>(null);
  useEffect(() => {
    const st = timerState.state;
    if (st !== "WORK" && st !== "SHORT_BREAK" && st !== "LONG_BREAK") return;
    if (timerState.endsAt === null) return;
    const configured = durations[st]; // ms ตาม setting ปัจจุบัน
    if (remainingMs > configured + 1500 && clampedRef.current !== timerState.endsAt) {
      clampedRef.current = timerState.endsAt;
      void clampDuration();
    }
  }, [timerState.state, timerState.endsAt, remainingMs, durations, clampDuration]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [backlog, setBacklog] = useState<Task[]>([]);
  const [stats, setStats] = useState<DayStat[]>([]);
  const [panel, setPanel] = useState<SidePanel>("schedule");
  const [endingDay, setEndingDay] = useState(false);
  const [clearing, setClearing] = useState(false);

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

  // แสดง toast เมื่อ sync กับ server ล้มเหลว (เดิมเงียบ → "ค้าง" โดยไม่รู้สาเหตุ)
  useEffect(() => {
    if (syncError) showToast(`⚠️ ${syncError}`);
  }, [syncError, showToast]);

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

  const loadStats = useCallback(async () => {
    if (!roomId) return;
    const res = await fetch("/api/stats", { headers: roomHeaders });
    setStats((await res.json()) as DayStat[]);
  }, [roomId, roomHeaders]);

  const loadDayTasks = useCallback(
    async (date: string) => {
      if (!roomId) return [];
      const res = await fetch(`/api/stats/day?date=${encodeURIComponent(date)}`, {
        headers: roomHeaders,
      });
      return (await res.json()) as { id: number; title: string; completedPomodoros: number; estimatedPomodoros: number }[];
    },
    [roomId, roomHeaders]
  );

  useEffect(() => {
    if (!roomId) return;
    void loadTasks();
    void loadBacklog();
    void loadStats();
  }, [roomId, loadTasks, loadBacklog, loadStats]);

  // เปิดแท็บสถิติ → refresh (เผื่อ device อื่นปิดวันไปแล้ว)
  useEffect(() => {
    if (panel === "stats") void loadStats();
  }, [panel, loadStats]);

  // re-fetch task list + backlog ตอนสลับกลับมา device นี้ → task ตรงกันข้าม device
  // (คู่กับ session refresh ใน usePomodoro ที่ sync state ตอน visible)
  useEffect(() => {
    if (!roomId) return;
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      void loadTasks();
      void loadBacklog();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [roomId, loadTasks, loadBacklog]);

  // ─── Auto จบวันเที่ยงคืน ───────────────────
  // จำวันล่าสุดที่ใช้งาน (localStorage ต่อห้อง) · เปิดแอป/สลับกลับมาแล้วข้ามวัน → auto เก็บ task
  // ที่เสร็จเข้าคลัง + reset timer · task ค้าง/รันอยู่คงเป็น pending → ยกมาวันใหม่เอง
  const checkDayRollover = useCallback(async () => {
    if (!roomId) return;
    const key = `pomodachi:lastDate:${roomId}`;
    const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD (local) → เทียบ string ได้ตรง
    let last: string | null = null;
    try {
      last = localStorage.getItem(key);
    } catch {
      /* localStorage ปิด → ข้าม auto (manual ยังใช้ได้) */
    }
    if (last && last < today) {
      await fetch("/api/tasks/archive", {
        method: "POST",
        headers: roomHeaders,
        body: JSON.stringify({ resetSession: true }),
      });
      await Promise.all([loadTasks(), loadBacklog(), generateSchedule(), refresh(), loadStats()]);
      showToast("🌙 ขึ้นวันใหม่ — เก็บ task ที่เสร็จเข้าคลังให้แล้ว");
    }
    try {
      localStorage.setItem(key, today);
    } catch {
      /* noop */
    }
  }, [roomId, roomHeaders, loadTasks, loadBacklog, generateSchedule, refresh, loadStats, showToast]);

  useEffect(() => {
    if (!roomId) return;
    void checkDayRollover();
    function onVisible() {
      if (document.visibilityState === "visible") void checkDayRollover();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [roomId, checkDayRollover]);

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

    if (running) {
      // มี task กำลังโฟกัสอยู่จริง + เลือกตัวอื่น → confirm switch (ลูกปัจจุบันจะไม่นับ)
      if (timerState.currentTaskId != null && taskId !== timerState.currentTaskId) {
        const target = tasks.find((t) => t.id === taskId);
        setPendingSwitch({ kind: "switch", toId: taskId, toTitle: target?.title ?? "task" });
        return;
      }
      // running แต่ไม่มี task ผูกอยู่ (เช่น ค้าง PAUSED/break ไม่มี task) → เริ่ม task นี้เลย
      // ใช้ switch (เริ่ม WORK ใหม่ได้จากทุก state ไม่เหมือน start ที่ต้อง IDLE) ไม่ต้อง confirm
      await handleSwitchTask(taskId);
      return;
    }
    await handleStart(taskId); // IDLE → start ปกติ
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
    await Promise.all([loadTasks(), loadBacklog()]); // reload ทั้งสอง — edit ใช้ได้ทั้ง Schedule + Backlog
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
    await Promise.all([loadTasks(), loadBacklog()]); // ลบได้ทั้ง Schedule + Backlog
    await generateSchedule();
  }

  /** ย้าย task ขึ้น/ลง 1 ตำแหน่งใน queue (สลับกับเพื่อนบ้าน)
   *  เดิมใช้ priority ± 1 → พังเมื่อทุก task priority เท่ากัน (เช่นทุกตัว = 0 ค่า default)
   *  วิธีใหม่: เรียงตามที่แสดงจริง (priority desc, id asc) → สลับกับเพื่อนบ้าน →
   *  reassign priority ให้ต่างกันชัด (len..1) เฉพาะตัวที่เปลี่ยน → การันตีขยับ 1 ตำแหน่งเสมอ */
  async function moveTask(taskId: number, dir: "up" | "down") {
    // queue = task ที่ยังไม่ done เรียงแบบเดียวกับที่แสดงใน ScheduleMain
    const queue = tasks
      .filter((t) => t.status !== "done")
      .sort((a, b) =>
        b.priority !== a.priority ? b.priority - a.priority : a.id - b.id
      );

    const i = queue.findIndex((t) => t.id === taskId);
    if (i === -1) return;
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= queue.length) return; // สุดขอบแล้ว ไม่ต้องทำอะไร

    const moving = queue[i];
    const neighbor = queue[j];
    if (!moving || !neighbor) return;

    // สลับตำแหน่งใน array
    const reordered = [...queue];
    reordered[i] = neighbor;
    reordered[j] = moving;

    // reassign priority แบบ distinct: บนสุด = len, ล่างสุด = 1
    // PATCH เฉพาะตัวที่ค่าเปลี่ยน (ปกติ = 2 ตัวที่สลับ)
    const len = reordered.length;
    await Promise.all(
      reordered.map((t, idx) => {
        const newPriority = len - idx;
        if (t.priority === newPriority) return null;
        return fetch(`/api/tasks/${t.id}`, {
          method: "PATCH",
          headers: roomHeaders,
          body: JSON.stringify({ priority: newPriority }),
        });
      })
    );

    await loadTasks();
    await generateSchedule();
  }

  const handlePriorityUp = (taskId: number) => moveTask(taskId, "up");
  const handlePriorityDown = (taskId: number) => moveTask(taskId, "down");

  /** ลากเรียงใหม่ทั้งชุด (orderedIds = บน→ล่าง) → reassign priority แบบ distinct (len..1)
   *  PATCH เฉพาะตัวที่ค่าเปลี่ยน · ใช้ scheme เดียวกับ moveTask (priority desc) */
  async function handleReorder(orderedIds: number[]) {
    const len = orderedIds.length;
    await Promise.all(
      orderedIds.map((id, idx) => {
        const newPriority = len - idx;
        const t = tasks.find((x) => x.id === id);
        if (t && t.priority === newPriority) return null;
        return fetch(`/api/tasks/${id}`, {
          method: "PATCH",
          headers: roomHeaders,
          body: JSON.stringify({ priority: newPriority }),
        });
      })
    );
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

  /** เก็บ task ที่เสร็จแล้วเข้าคลัง (status → archived) → หายจาก Schedule · ไม่แตะ task ค้าง/timer
   *  (สถิติไม่กระทบ — ยอดรายวัน derive จาก doneDate ที่ stamp ตอนขีดฆ่าไปแล้ว) */
  async function handleClearDone() {
    setClearing(true);
    const res = await fetch("/api/tasks/archive", { method: "POST", headers: roomHeaders });
    const data = (await res.json().catch(() => null)) as { archived?: number } | null;
    await Promise.all([loadTasks(), generateSchedule(), loadStats()]);
    setClearing(false);
    showToast(`🧹 เก็บ ${data?.archived ?? 0} task ที่เสร็จเข้าคลังแล้ว`);
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

  const currentTaskRaw =
    tasks.find((t) => t.id === timerState.currentTaskId) ?? null;
  // ถ้า timer ชี้ task ที่ done แล้ว (client optimistic ยัง carry task เก่าตอน break→work
  // ก่อน server reconcile) → ไม่ถือว่าเป็น current · + self-heal ด้วย refresh ด้านล่าง
  const currentTask =
    currentTaskRaw && currentTaskRaw.status !== "done" ? currentTaskRaw : null;

  // self-heal: timer WORK/PAUSED แต่ currentTaskId ชี้ task ที่ done → re-sync จาก server
  // (server advance ไป task ถัดไปแล้ว · กันค้างโชว์ task ขีดฆ่าเมื่อ reconcile พลาด/เน็ตสะดุด)
  const healingRef = useRef<number | null>(null);
  useEffect(() => {
    const running =
      timerState.state === "WORK" || timerState.state === "PAUSED";
    if (!running || timerState.currentTaskId == null) {
      healingRef.current = null;
      return;
    }
    const cur = tasks.find((t) => t.id === timerState.currentTaskId);
    if (cur && cur.status === "done" && healingRef.current !== timerState.currentTaskId) {
      healingRef.current = timerState.currentTaskId; // กัน refresh ซ้ำสำหรับ task เดิม
      void refresh();
    }
  }, [timerState.state, timerState.currentTaskId, tasks, refresh]);

  // Pending tasks เรียง priority สูง→ต่ำ → id (ให้ Timer ใช้ preview/picker ตอน IDLE)
  const pendingTasks = tasks
    .filter((t) => t.status === "pending" || t.status === "in-progress")
    .sort((a, b) =>
      b.priority !== a.priority ? b.priority - a.priority : a.id - b.id
    );

  // "ต่อเวลา": จบ task ก่อนเวลา (currentTaskId = null) แต่ยัง WORK + มี task เหลือ
  // → โชว์ task ถัดไปว่ากำลังทำในเวลาที่เหลือ (ลูกนี้ยังไม่นับให้มัน)
  const isRunning =
    timerState.state === "WORK" || timerState.state === "PAUSED";
  const bonusTask =
    !currentTask && isRunning && timerState.endsAt !== null ? pendingTasks[0] : null;
  const currentTaskTitle = currentTask
    ? currentTask.title
    : bonusTask
      ? `${bonusTask.title} (ต่อเวลา)`
      : null;

  // จบ task ปัจจุบันก่อนเวลา
  async function handleFinish() {
    const title = currentTask?.title ?? "task";
    await handleFinishEarly();
    await loadTasks();
    showToast(`✓ เสร็จ “${title}”`);
  }

  return (
    <div className="min-h-screen ember-bg text-foreground relative flex flex-col md:grid md:grid-cols-[3fr_2fr] md:h-screen">
      {/* build version (เล็กมุมล่างซ้าย จางๆ) — ยืนยันว่า client รัน bundle เวอร์ชันไหน */}
      <span className="fixed bottom-1 left-1 z-[60] text-[9px] font-mono text-[var(--faint)] opacity-40 pointer-events-none">
        {process.env.NEXT_PUBLIC_BUILD_ID}
      </span>

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
            currentTaskTitle={currentTaskTitle}
            perLong={durations.POMODOROS_PER_LONG_BREAK}
            pendingTasks={pendingTasks}
            onStart={(taskId) => handleStart(taskId)}
            onPause={handlePause}
            onResume={handleResume}
            onRestart={handleRestart}
            onSkip={() => setPendingSwitch({ kind: "skip" })}
            onFinishEarly={currentTask ? handleFinish : undefined}
          />

          {/* เตือนเฉพาะตอน wake lock ไม่ทำงาน (เช่น Samsung battery management ปฏิเสธ)
              — กรณีปกติ (จอไม่ดับ) ไม่ต้องโชว์อะไร */}
          {!wakeLockActive &&
            (timerState.state === "WORK" ||
              timerState.state === "SHORT_BREAK" ||
              timerState.state === "LONG_BREAK") && (
              <div className="mt-5 flex justify-center">
                <span className="text-xs text-[var(--accent-strong,#9a4a2c)] bg-card/80 rounded-full px-3 py-1 border border-[var(--border-strong,#d8a07a)] text-center max-w-[260px]">
                  ⚠️ เบราว์เซอร์ไม่ได้ล็อกจอให้ — ถ้าจอดับ เสียงเตือนอาจไม่ดัง (เปิดจอค้างไว้)
                </span>
              </div>
            )}
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
            {(["schedule", "backlog", "stats", "settings"] as SidePanel[]).map((tab) => (
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
                pendingCount={pendingCount}
                onAdd={handleAddTask}
                onSelect={handleSelectAndStart}
                onPriorityUp={handlePriorityUp}
                onPriorityDown={handlePriorityDown}
                onReorder={handleReorder}
                onEdit={handleEditTask}
                onMoveToBacklog={handleMoveToBacklog}
                onDelete={handleDeleteTask}
                onEndDay={handleEndDay}
                endingDay={endingDay}
                onClearDone={handleClearDone}
                clearing={clearing}
              />
            )}

            {panel === "backlog" && (
              <BacklogView
                tasks={backlog}
                onAdd={handleAddToBacklog}
                onMoveToActive={handleMoveToActive}
                onScheduleTask={handleScheduleTask}
                onEdit={handleEditTask}
                onDelete={handleDeleteTask}
              />
            )}

            {panel === "stats" && <StatsView days={stats} onLoadDay={loadDayTasks} />}

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
          {/* scrim — เบลอพื้นหลังทั้งหน้า → ข้อความ layer ล่างกลายเป็นฝ้า ไม่ทะลุมาแย่ง modal
              (กุญแจของ glass UI ที่อ่านง่าย: frost สิ่งที่อยู่ข้างหลังก่อน) */}
          <div
            className="fixed inset-0 z-[55] bg-black/20"
            style={{ backdropFilter: "blur(8px) saturate(115%)", WebkitBackdropFilter: "blur(8px) saturate(115%)" }}
            onClick={() => setPendingSwitch(null)}
          />
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
              <strong> จะไม่ถูกนับ</strong> (เริ่มลูกใหม่ที่ {formatTime(durations.WORK)})
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
