"use client";

import type { DaySummary } from "@/generated/prisma/client";

interface StatsViewProps {
  days: DaySummary[];
}

/** แปลง "YYYY-MM-DD" → วันที่ไทยอ่านง่าย (สร้างแบบ local กัน timezone เลื่อน) */
function formatThaiDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function StatsView({ days }: StatsViewProps) {
  if (days.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 py-10 text-center h-full">
        <span className="text-3xl opacity-60">📊</span>
        <p className="text-[var(--ink-soft)] text-sm max-w-[240px]">
          ยังไม่มีสถิติ — พอปิดวัน (เก็บ task ที่เสร็จ / จบวัน / ขึ้นวันใหม่) ยอดของแต่ละวันจะมาสะสมที่นี่
        </p>
      </div>
    );
  }

  const totalPomodoros = days.reduce((s, d) => s + d.totalPomodoros, 0);
  const totalTasks = days.reduce((s, d) => s + d.tasksDone, 0);
  const maxPomodoros = Math.max(...days.map((d) => d.totalPomodoros), 1);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* สรุปรวม */}
      <div className="border border-border rounded-2xl p-4 bg-card flex items-center justify-around text-center">
        <div className="flex flex-col">
          <span className="text-2xl font-semibold text-primary">{totalPomodoros}</span>
          <span className="text-xs text-muted-foreground">🍅 ลูกรวม</span>
        </div>
        <div className="w-px self-stretch bg-border" />
        <div className="flex flex-col">
          <span className="text-2xl font-semibold" style={{ color: "var(--success)" }}>
            {totalTasks}
          </span>
          <span className="text-xs text-muted-foreground">✓ task รวม</span>
        </div>
        <div className="w-px self-stretch bg-border" />
        <div className="flex flex-col">
          <span className="text-2xl font-semibold text-foreground">{days.length}</span>
          <span className="text-xs text-muted-foreground">📅 วันที่บันทึก</span>
        </div>
      </div>

      {/* รายวัน (ใหม่สุดก่อน) */}
      <ul className="flex flex-col gap-2">
        {days.map((d) => (
          <li
            key={d.id}
            className="border border-border rounded-xl p-3 bg-card flex flex-col gap-2"
          >
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{formatThaiDate(d.date)}</span>
              <span className="flex gap-3 text-xs">
                <span className="text-primary font-semibold">{d.totalPomodoros} 🍅</span>
                <span style={{ color: "var(--success)" }}>✓ {d.tasksDone}</span>
              </span>
            </div>
            {/* แท่งสัดส่วน 🍅 เทียบวันที่ทำมากสุด */}
            <div className="h-1.5 rounded-full bg-[rgba(120,80,40,0.1)] overflow-hidden">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${(d.totalPomodoros / maxPomodoros) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
