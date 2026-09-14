"use client";
import * as React from "react";
import { CirclePlus } from "lucide-react";
import { Input } from "@/components/ui/input";

export function QuickAdd({ onCreate, placeholder }: { onCreate: (title: string) => Promise<void>; placeholder?: string }) {
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
    <div className="flex items-center gap-2 rounded-xl bg-surface-lowest p-3 shadow-sm transition-shadow focus-within:shadow-md">
      <CirclePlus className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Add a task... (press Enter)"}
        disabled={isSubmitting}
        className="h-auto border-none bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
