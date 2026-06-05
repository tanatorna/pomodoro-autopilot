"use client";

import { Button } from "@/components/ui/button";
import type { PomodoroSettings } from "@/hooks/useSettings";
import { DEFAULT_SETTINGS } from "@/hooks/useSettings";

interface SettingsPanelProps {
  settings: PomodoroSettings;
  onChange: (patch: Partial<PomodoroSettings>) => void;
}

interface NumberInputRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
}

function NumberInputRow({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "นาที",
  onChange,
}: NumberInputRowProps) {
  function clamp(v: number) {
    return Math.min(max, Math.max(min, v));
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-[var(--ink-soft)] flex-1">{label}</span>

      <div className="flex items-center gap-1.5">
        {/* ลด */}
        <button
          onClick={() => onChange(clamp(value - step))}
          disabled={value <= min}
          className="w-7 h-7 rounded-md bg-card border border-border
            text-[var(--ink-soft)] hover:bg-secondary hover:text-foreground
            disabled:opacity-30 disabled:cursor-not-allowed
            flex items-center justify-center text-base font-bold
            transition-colors select-none"
        >
          −
        </button>

        {/* Input ตัวเลข */}
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v)) onChange(clamp(v));
          }}
          className="w-14 h-7 text-center text-sm font-mono font-semibold
            bg-card border border-border rounded-md text-primary
            focus:outline-none focus:border-primary
            [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />

        {/* เพิ่ม */}
        <button
          onClick={() => onChange(clamp(value + step))}
          disabled={value >= max}
          className="w-7 h-7 rounded-md bg-card border border-border
            text-[var(--ink-soft)] hover:bg-secondary hover:text-foreground
            disabled:opacity-30 disabled:cursor-not-allowed
            flex items-center justify-center text-base font-bold
            transition-colors select-none"
        >
          +
        </button>

        <span className="text-xs text-muted-foreground w-8">{unit}</span>
      </div>
    </div>
  );
}

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-sm font-semibold text-muted-foreground tracking-wider mb-3">
        ตั้งค่าเวลา
      </h2>

      <div className="flex flex-col divide-y divide-border">
        <div className="py-3">
          <NumberInputRow
            label="⏱ Focus (Pomodoro)"
            value={settings.workMinutes}
            min={1}
            max={60}
            step={1}
            onChange={(v) => onChange({ workMinutes: v })}
          />
        </div>

        <div className="py-3">
          <NumberInputRow
            label="☕ Short Break"
            value={settings.shortBreakMinutes}
            min={1}
            max={15}
            step={1}
            onChange={(v) => onChange({ shortBreakMinutes: v })}
          />
        </div>

        <div className="py-3">
          <NumberInputRow
            label="🛋️ Long Break"
            value={settings.longBreakMinutes}
            min={1}
            max={60}
            step={1}
            onChange={(v) => onChange({ longBreakMinutes: v })}
          />
        </div>

        <div className="py-3">
          <NumberInputRow
            label="🔄 Long break ทุกกี่รอบ"
            value={settings.pomodorosPerLongBreak}
            min={2}
            max={8}
            step={1}
            unit="รอบ"
            onChange={(v) => onChange({ pomodorosPerLongBreak: v })}
          />
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange(DEFAULT_SETTINGS)}
        className="text-[var(--ink-soft)] hover:text-foreground text-xs mt-3 w-full"
      >
        ↺ Reset เป็นค่า default (25/5/15)
      </Button>
    </div>
  );
}
