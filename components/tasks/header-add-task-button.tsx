"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { createTask } from "@/lib/tasks/tasks";

export function HeaderAddTaskButton({ userId }: { userId: string }) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleCreate() {
    const trimmed = title.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    const { error } = await createTask(supabase, userId, { title: trimmed });
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Added to Inbox");
    setTitle("");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add a task</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogTitle>New task</DialogTitle>
        <div className="flex flex-col gap-3 pt-2">
          <Input
            autoFocus
            placeholder="What do you need to do?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
          <p className="text-xs text-on-surface-variant">Goes to your Inbox — organize it whenever you&apos;re ready.</p>
          <Button onClick={handleCreate} disabled={!title.trim() || submitting} className="self-end">
            {submitting ? "Adding…" : "Add task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
