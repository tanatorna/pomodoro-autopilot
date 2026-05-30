"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface BrainDumpProps {
  onAdd: (title: string) => Promise<void>;
}

export function BrainDump({ onAdd }: BrainDumpProps) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setLoading(true);
    await onAdd(value.trim());
    setValue("");
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="พิมพ์ task... แล้วกด Enter"
        disabled={loading}
        className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-amber-500"
      />
      <Button
        type="submit"
        disabled={loading || !value.trim()}
        className="bg-amber-500 hover:bg-amber-400 text-black font-semibold shrink-0"
      >
        เพิ่ม
      </Button>
    </form>
  );
}
