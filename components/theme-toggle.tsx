"use client";
import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", description: "Warm ivory", icon: Sun },
  { value: "dark", label: "Dark", description: "Midnight ink", icon: Moon },
  { value: "system", label: "System", description: "Follow OS clock", icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
      {OPTIONS.map(({ value, label, description, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={cn(
              "flex flex-col items-start gap-2 rounded-xl p-3 text-left shadow-xs transition-all",
              active ? "bg-surface-container-low" : "bg-surface-lowest hover:bg-surface-container-low"
            )}
          >
            <div className="flex h-12 w-full items-center justify-center rounded-lg bg-surface-container text-on-surface-variant">
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex w-full items-center justify-between">
              <span className="text-sm font-medium text-on-surface">{label}</span>
              {active && <Check className="h-4 w-4 text-primary" />}
            </div>
            <span className={cn("text-xs", active ? "font-medium text-primary" : "text-on-surface-variant")}>
              {description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
