"use client";

import { Button } from "@/components/ui/button";
import type { PomodoroSettings } from "@/hooks/useSettings";
import { DEFAULT_SETTINGS } from "@/hooks/useSettings";

interface SettingsPanelProps {
  settings: PomodoroSettings;
  onChange: (patch: Partial<PomodoroSettings>) => void;
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
}

function SliderRow({ label, value, min, max, step = 1, unit = "นาที", onChange }: SliderRowProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs text-zinc-400">{label}</span>
        <span className="text-sm font-mono font-semibold text-amber-400">
          {value} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer
          bg-zinc-700 accent-amber-500"
      />
      <div className="flex justify-between text-xs text-zinc-700">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
        ตั้งค่าเวลา
      </h2>

      <SliderRow
        label="⏱ Focus (Pomodoro)"
        value={settings.workMinutes}
        min={5}
        max={60}
        step={5}
        onChange={(v) => onChange({ workMinutes: v })}
      />

      <SliderRow
        label="☕ Short Break"
        value={settings.shortBreakMinutes}
        min={1}
        max={15}
        step={1}
        onChange={(v) => onChange({ shortBreakMinutes: v })}
      />

      <SliderRow
        label="🛋️ Long Break"
        value={settings.longBreakMinutes}
        min={5}
        max={45}
        step={5}
        onChange={(v) => onChange({ longBreakMinutes: v })}
      />

      <SliderRow
        label="🔄 Long break ทุก กี่รอบ"
        value={settings.pomodorosPerLongBreak}
        min={2}
        max={8}
        step={1}
        unit="รอบ"
        onChange={(v) => onChange({ pomodorosPerLongBreak: v })}
      />

      {/* Reset to default */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange(DEFAULT_SETTINGS)}
        className="text-zinc-600 hover:text-zinc-400 text-xs mt-2"
      >
        ↺ Reset เป็นค่า default (25/5/15)
      </Button>
    </div>
  );
}
