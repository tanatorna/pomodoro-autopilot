"use client";

import { useState } from "react";

export interface DayStat {
  date: string; // YYYY-MM-DD
  totalPomodoros: number;
  tasksDone: number;
}

interface DayTask {
  id: number;
  title: string;
  completedPomodoros: number;
  estimatedPomodoros: number;
}

interface StatsViewProps {
  days: DayStat[];
  onLoadDay: (date: string) => Promise<DayTask[]>;
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

export function StatsView({ days, onLoadDay }: StatsViewProps) {
  // วันที่กำลังกางอยู่ + cache รายการ task ต่อวัน (null = กำลังโหลด)
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [dayTasks, setDayTasks] = useState<Record<string, DayTask[] | null>>({});

  async function toggleDay(date: string) {
    if (openDate === date) {
      setOpenDate(null);
      return;
    }
    setOpenDate(date);
    if (dayTasks[date] === undefined) {
      setDayTasks((prev) => ({ ...prev, [date]: null })); // loading
      const tasks = await onLoadDay(date);
      setDayTasks((prev) => ({ ...prev, [date]: tasks }));
    }
  }

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
  // เฉลี่ยต่อวัน = baseline ของตัวเอง (มีความหมายกว่ายอดรวมที่โตไปเรื่อยๆ)
  const avgPomodoros = (totalPomodoros / days.length).toFixed(1);
  const avgTasks = (totalTasks / days.length).toFixed(1);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* สรุปรวม */}
      <div className="border border-border rounded-2xl p-4 bg-card flex items-center justify-around text-center">
        <div className="flex flex-col">
          <span className="text-2xl font-semibold text-primary">{avgPomodoros}</span>
          <span className="text-xs text-muted-foreground">🍅 เฉลี่ย/วัน</span>
        </div>
        <div className="w-px self-stretch bg-border" />
        <div className="flex flex-col">
          <span className="text-2xl font-semibold" style={{ color: "var(--success)" }}>
            {avgTasks}
          </span>
          <span className="text-xs text-muted-foreground">✓ task เฉลี่ย/วัน</span>
        </div>
        <div className="w-px self-stretch bg-border" />
        <div className="flex flex-col">
          <span className="text-2xl font-semibold text-foreground">{days.length}</span>
          <span className="text-xs text-muted-foreground">📅 วันที่บันทึก</span>
        </div>
      </div>

      {/* รายวัน (ใหม่สุดก่อน) — คลิกเพื่อกางดู task ของวันนั้น */}
      <ul className="flex flex-col gap-2">
        {days.map((d) => {
          const isOpen = openDate === d.date;
          const tasks = dayTasks[d.date];
          return (
            <li
              key={d.date}
              className="border border-border rounded-xl bg-card overflow-hidden"
            >
              <button
                onClick={() => toggleDay(d.date)}
                className="w-full p-3 flex flex-col gap-2 text-left hover:bg-muted/40 transition-colors"
                aria-expanded={isOpen}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    <span
                      className="text-xs text-muted-foreground transition-transform"
                      style={{ transform: isOpen ? "rotate(90deg)" : "none" }}
                    >
                      ▸
                    </span>
                    {formatThaiDate(d.date)}
                  </span>
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
              </button>

              {/* รายละเอียด task ของวันนั้น */}
              {isOpen && (
                <div className="px-3 pb-3 pt-1 border-t border-border/60">
                  {tasks === undefined || tasks === null ? (
                    <p className="text-xs text-muted-foreground py-2">กำลังโหลด...</p>
                  ) : tasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      ไม่มีรายละเอียด task ของวันนี้ (task ถูกเก็บก่อนมีฟีเจอร์นี้)
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1.5 pt-2">
                      {tasks.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center justify-between text-sm gap-2"
                        >
                          <span className="text-foreground truncate">{t.title}</span>
                          <span className="text-xs text-primary font-medium shrink-0">
                            {t.completedPomodoros} 🍅
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
