"use client";
import * as React from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";

export function QuickAdd({ onCreate }: { onCreate: (title: string) => Promise<void> }) {
  const [title, setTitle] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const trimmed = title.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onCreate(trimmed);
      setTitle("");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2">
      <Plus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a task, press Enter…"
        disabled={isSubmitting}
        className="border-none px-0 shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
