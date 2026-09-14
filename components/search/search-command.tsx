"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { createClient } from "@/lib/supabase/client";
import { listTasks } from "@/lib/tasks/tasks";
import type { Database } from "@/types/database";

type TaskRow = Database["flowdo"]["Tables"]["tasks"]["Row"];

export function SearchCommand() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<TaskRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();
  const supabase = createClient();

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      const { data } = await listTasks(supabase, { search: trimmed, limit: 8 });
      setResults(data ?? []);
      setLoading(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open]);

  function openTask(taskId: string) {
    setOpen(false);
    setQuery("");
    router.push(`/app/inbox?task=${taskId}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-full max-w-xs items-center gap-2 rounded-xl bg-surface-lowest px-3 text-sm text-on-surface-variant shadow-xs transition-shadow hover:shadow-sm sm:max-w-sm"
      >
        <Search className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1 truncate text-left">Search your tasks...</span>
        <kbd className="hidden shrink-0 rounded bg-surface-container px-1.5 py-0.5 text-[11px] text-on-surface-variant sm:inline">
          ⌘K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search your tasks..." value={query} onValueChange={setQuery} />
        <CommandList>
          {!loading && query.trim() && results.length === 0 && (
            <CommandEmpty>No tasks match &ldquo;{query}&rdquo;.</CommandEmpty>
          )}
          {!query.trim() && <CommandEmpty>Start typing to search your tasks.</CommandEmpty>}
          {results.length > 0 && (
            <CommandGroup heading="Tasks">
              {results.map((task) => (
                <CommandItem key={task.id} value={task.id} onSelect={() => openTask(task.id)}>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-outline" />
                  <span className="truncate">{task.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
