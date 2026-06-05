"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface TaskFormProps {
  /** placeholder ของ title input */
  placeholder?: string;
  /** label ปุ่ม submit */
  submitLabel?: string;
  /** เรียกเมื่อ submit */
  onAdd: (title: string, estimatedPomodoros: number) => Promise<void>;
}

export function TaskForm({
  placeholder = "เพิ่ม task...",
  submitLabel = "เพิ่ม",
  onAdd,
}: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [pomodoros, setPomodoros] = useState(1);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || !title.trim()) return; // guard กัน double-submit แทนการ disable input
    setLoading(true);
    await onAdd(title.trim(), pomodoros);
    setTitle("");
    setPomodoros(1);
    setLoading(false);
    // ไม่ disable input ระหว่างโหลด → focus อยู่ที่ช่องเดิม พิมพ์ task ต่อได้เลย
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center">
      {/* Title */}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        autoFocus
        className="bg-card border-border text-foreground placeholder:text-muted-foreground
          focus-visible:ring-primary/40 focus-visible:border-primary flex-1 min-w-0 h-9"
      />

      {/* Estimated pomodoros — stepper */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setPomodoros((p) => Math.max(1, p - 1))}
          disabled={pomodoros <= 1}
          className="w-6 h-6 rounded-md bg-card border border-border text-muted-foreground
            hover:bg-secondary disabled:opacity-30 text-xs flex items-center justify-center"
        >
          −
        </button>
        <span className="text-xs font-semibold text-primary w-8 text-center">
          {pomodoros}🍅
        </span>
        <button
          type="button"
          onClick={() => setPomodoros((p) => Math.min(12, p + 1))}
          disabled={pomodoros >= 12}
          className="w-6 h-6 rounded-md bg-card border border-border text-muted-foreground
            hover:bg-secondary disabled:opacity-30 text-xs flex items-center justify-center"
        >
          +
        </button>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        disabled={loading || !title.trim()}
        className="bg-primary hover:bg-[var(--accent-hover)] text-primary-foreground font-semibold shrink-0 px-4 h-9"
      >
        {submitLabel}
      </Button>
    </form>
  );
}
