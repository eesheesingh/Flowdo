"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createTask } from "@/lib/tasks/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateTaskDialog({
  date,
  userId,
  onOpenChange,
}: {
  date: string; // "YYYY-MM-DD"
  userId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const supabase = createClient();
  const qc = useQueryClient();
  const [title, setTitle] = React.useState("");
  const create = useMutation({
    mutationFn: () => createTask(supabase, userId, { title: title.trim(), dueDate: `${date}T09:00:00.000Z` }),
    onSuccess: (r) => {
      if (!r.error) {
        qc.invalidateQueries({ queryKey: ["tasks"] });
        onOpenChange(false);
      }
    },
  });

  return (
    <Dialog.Root open onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-lg bg-background p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">New task on {date}</Dialog.Title>
            <Dialog.Close aria-label="Close"><X className="h-5 w-5" /></Dialog.Close>
          </div>
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
                 onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) create.mutate(); }}
                 placeholder="Task title" />
          <div className="flex justify-end">
            <Button type="button" disabled={!title.trim()} onClick={() => create.mutate()}>Add task</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
