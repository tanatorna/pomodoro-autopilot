"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Expanded form */}
      {open && (
        <div className="bg-zinc-900 border border-red-500/40 rounded-xl p-4 w-72 shadow-2xl">
          <p className="text-sm font-medium text-red-400 mb-3">
            ⚡ งานด่วน — แทรกเลย
          </p>
          <p className="text-xs text-zinc-500 mb-3">
            Pomodoro ปัจจุบันจะถูก void และระบบจะเริ่ม task ใหม่ทันที
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="งานด่วนคืออะไร?"
              disabled={loading}
              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500"
            />
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={loading || !title.trim()}
                className="flex-1 bg-red-500 hover:bg-red-400 text-white font-semibold text-sm"
              >
                {loading ? "กำลังแทรก..." : "แทรกเลย"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setOpen(false); setTitle(""); }}
                className="text-zinc-500 hover:text-zinc-300 text-sm"
              >
                ยกเลิก
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Trigger button */}
      <Button
        onClick={() => setOpen((o) => !o)}
        className={`rounded-full w-12 h-12 shadow-lg text-lg transition-all
          ${open
            ? "bg-zinc-700 hover:bg-zinc-600"
            : "bg-red-500 hover:bg-red-400 animate-pulse"
          }`}
        title="งานด่วน"
      >
        {open ? "✕" : "⚡"}
      </Button>
    </div>
  );
}
