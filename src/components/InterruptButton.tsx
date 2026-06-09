"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

interface InterruptButtonProps {
  /** แสดงเฉพาะตอน WORK หรือ PAUSED */
  visible: boolean;
  onInterrupt: (title: string) => Promise<void>;
}

export function InterruptButton({ visible, onInterrupt }: InterruptButtonProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  if (!visible) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    await onInterrupt(title.trim());
    setTitle("");
    setOpen(false);
    setLoading(false);
  }

  return (
    <>
      {/* scrim — frost พื้นหลังบางๆ ตอนเปิด (ค่าเดียวกับ room/account dropdown) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/[0.04]"
          style={{ backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}
          onClick={() => setOpen(false)}
        />
      )}

      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Expanded form */}
      {open && (
        <div
          className="pm-pop rounded-2xl p-4 w-72"
          style={{
            // glass แท้แต่อ่านง่าย (เหมือน room/account dropdown) — กันข้อความ layer ล่างทะลุ
            background: "rgba(255, 252, 246, 0.78)",
            backdropFilter: "blur(32px) saturate(150%)",
            WebkitBackdropFilter: "blur(32px) saturate(150%)",
            border: "1px solid var(--border-active)",
            boxShadow: "0 14px 40px rgba(120,80,40,0.2)",
          }}
        >
          <p className="text-sm font-semibold mb-2" style={{ color: "var(--danger)" }}>
            ⚡ งานด่วน — แทรกเลย
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Pomodoro ปัจจุบันจะถูก void และระบบจะเริ่ม task ใหม่ทันที
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="งานด่วนคืออะไร?"
              disabled={loading}
              className="bg-card border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading || !title.trim()}
                className="flex-1 rounded-lg text-white font-semibold text-sm py-2 disabled:opacity-50 hover:opacity-90"
                style={{ background: "var(--danger)" }}
              >
                {loading ? "กำลังแทรก..." : "แทรกเลย"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setTitle("");
                }}
                className="text-muted-foreground hover:text-foreground text-sm px-3"
              >
                ยกเลิก
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`rounded-full w-12 h-12 text-lg text-white flex items-center justify-center transition-all
          ${open ? "bg-secondary !text-foreground border border-border" : "hover:opacity-90 animate-pulse"}`}
        style={open ? undefined : { background: "var(--danger)", boxShadow: "0 8px 24px rgba(182,69,46,0.4)" }}
        title="งานด่วน"
      >
        {open ? "✕" : "⚡"}
      </button>
      </div>
    </>
  );
}
