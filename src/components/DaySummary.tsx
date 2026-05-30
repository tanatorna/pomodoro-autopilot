"use client";

import { Button } from "@/components/ui/button";

interface DaySummaryProps {
  /** จำนวน Pomodoro ที่ทำสำเร็จวันนี้ */
  completedPomodoros: number;
  /** จำนวน tasks ที่เหลือ (pending/in-progress) */
  pendingCount: number;
  onEndDay: () => Promise<void>;
  ending: boolean;
}

export function DaySummary({
  completedPomodoros,
  pendingCount,
  onEndDay,
  ending,
}: DaySummaryProps) {
  return (
    <div className="border border-zinc-700/50 rounded-xl p-4 bg-zinc-800/30 flex flex-col gap-4">
      {/* Title */}
      <div className="flex items-center gap-2">
        <span className="text-xl">🌙</span>
        <h3 className="text-sm font-semibold text-zinc-200">สรุปวันนี้</h3>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-800 rounded-lg p-3 text-center">
          <p className="text-2xl font-mono font-bold text-amber-400">
            {completedPomodoros}
          </p>
          <p className="text-xs text-zinc-500 mt-1">🍅 Pomodoro สำเร็จ</p>
        </div>
        <div className="bg-zinc-800 rounded-lg p-3 text-center">
          <p className="text-2xl font-mono font-bold text-zinc-400">
            {pendingCount}
          </p>
          <p className="text-xs text-zinc-500 mt-1">task ค้างอยู่</p>
        </div>
      </div>

      {/* End of day action */}
      {pendingCount > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-zinc-500">
            กด "จบวัน" เพื่อย้าย {pendingCount} task ที่เหลือไป Backlog
            และ reset timer พร้อมวันใหม่
          </p>
          <Button
            onClick={onEndDay}
            disabled={ending}
            className="w-full bg-zinc-700 hover:bg-zinc-600 text-zinc-200 font-medium text-sm"
          >
            {ending ? "กำลังจัดการ..." : "🌙 จบวัน → ย้ายไป Backlog"}
          </Button>
        </div>
      )}

      {pendingCount === 0 && (
        <p className="text-xs text-emerald-500 text-center">
          ✅ เคลียร์ทุก task วันนี้แล้ว! ยอดเยี่ยมมาก
        </p>
      )}
    </div>
  );
}
