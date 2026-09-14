"use client";
import type { Recurrence, RecurrenceRule } from "@/lib/tasks/recurrence";

const PRESETS: Recurrence[] = ["NEVER", "DAILY", "WEEKLY", "MONTHLY", "YEARLY", "CUSTOM"];
const LABEL: Record<Recurrence, string> = {
  NEVER: "Doesn't repeat", DAILY: "Daily", WEEKLY: "Weekly",
  MONTHLY: "Monthly", YEARLY: "Yearly", CUSTOM: "Custom…",
};

export function RecurrenceField({
  value,
  onChange,
  hasDueDate,
}: {
  value: { recurrence: Recurrence; rule: RecurrenceRule | null };
  onChange: (next: { recurrence: Recurrence; rule: RecurrenceRule | null }) => void;
  hasDueDate: boolean;
}) {
  function pick(recurrence: Recurrence) {
    if (recurrence === "CUSTOM") {
      onChange({ recurrence, rule: value.rule ?? { interval: 1, unit: "week" } });
    } else {
      onChange({ recurrence, rule: null });
    }
  }

  return (
    <div className="space-y-2">
      <label htmlFor="recurrence" className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
        Repeat
      </label>
      <select
        id="recurrence"
        aria-label="Repeat"
        value={value.recurrence}
        disabled={!hasDueDate}
        onChange={(e) => pick(e.target.value as Recurrence)}
        className="flex h-10 w-full rounded-lg bg-surface-container-low px-3 text-sm text-on-surface outline-none transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
      >
        {PRESETS.map((p) => <option key={p} value={p}>{LABEL[p]}</option>)}
      </select>

      {!hasDueDate && <p className="text-xs text-on-surface-variant">Add a due date to repeat this task.</p>}

      {hasDueDate && value.recurrence === "CUSTOM" && value.rule && (
        <div className="flex items-center gap-2 text-sm text-on-surface">
          <span>every</span>
          <input
            type="number"
            min={1}
            aria-label="Interval"
            value={value.rule.interval}
            onChange={(e) => onChange({ recurrence: "CUSTOM", rule: { ...value.rule!, interval: Math.max(1, Number(e.target.value) || 1) } })}
            className="h-9 w-16 rounded-lg bg-surface-container-low px-2 text-on-surface outline-none"
          />
          <select
            aria-label="Interval unit"
            value={value.rule.unit}
            onChange={(e) => onChange({ recurrence: "CUSTOM", rule: { ...value.rule!, unit: e.target.value as RecurrenceRule["unit"] } })}
            className="h-9 rounded-lg bg-surface-container-low px-2 text-on-surface outline-none"
          >
            <option value="day">days</option>
            <option value="week">weeks</option>
            <option value="month">months</option>
            <option value="year">years</option>
          </select>
        </div>
      )}
    </div>
  );
}
