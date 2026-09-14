"use client";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { createTask } from "@/lib/tasks/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

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
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle>New task on {date}</DialogTitle>
        <div className="flex flex-col gap-4 pt-2">
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && title.trim()) create.mutate();
            }}
            placeholder="Task title"
          />
          <Button type="button" disabled={!title.trim()} onClick={() => create.mutate()} className="self-end">
            Add task
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
