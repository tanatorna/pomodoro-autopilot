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
    if (!title.trim()) return;
    setLoading(true);
    await onAdd(title.trim(), pomodoros);
    setTitle("");
    setPomodoros(1);
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center">
      {/* Title */}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        disabled={loading}
        className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500
          focus-visible:ring-amber-500 flex-1 min-w-0"
      />

      {/* Estimated pomodoros — เล็กแต่กดได้ */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setPomodoros((p) => Math.max(1, p - 1))}
          disabled={pomodoros <= 1}
          className="w-6 h-6 rounded bg-zinc-800 border border-zinc-700 text-zinc-400
            hover:bg-zinc-700 disabled:opacity-30 text-xs flex items-center justify-center"
        >
          −
        </button>
        <span className="text-xs font-mono text-amber-400 w-8 text-center">
          {pomodoros}🍅
        </span>
        <button
          type="button"
          onClick={() => setPomodoros((p) => Math.min(12, p + 1))}
          disabled={pomodoros >= 12}
          className="w-6 h-6 rounded bg-zinc-800 border border-zinc-700 text-zinc-400
            hover:bg-zinc-700 disabled:opacity-30 text-xs flex items-center justify-center"
        >
          +
        </button>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        disabled={loading || !title.trim()}
        className="bg-amber-500 hover:bg-amber-400 text-black font-semibold shrink-0 px-4"
      >
        {submitLabel}
      </Button>
    </form>
  );
}
