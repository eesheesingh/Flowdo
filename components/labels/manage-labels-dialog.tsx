"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { listLabels, createLabel, updateLabel, deleteLabel } from "@/lib/labels/labels";
import { PROJECT_COLORS } from "@/lib/constants/project-colors";
import { Button } from "@/components/ui/button";

export function ManageLabelsDialog({
  open,
  userId,
  onOpenChange,
}: {
  open: boolean;
  userId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const supabase = createClient();
  const qc = useQueryClient();
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState<string>(PROJECT_COLORS[0].value);

  const { data: labels = [] } = useQuery({
    queryKey: ["labels"],
    queryFn: async () => (await listLabels(supabase)).data ?? [],
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["labels"] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const add = useMutation({
    mutationFn: () => createLabel(supabase, userId, { name: name.trim(), color }),
    onSuccess: (r) => {
      if (!r.error) {
        setName("");
        invalidate();
      }
    },
  });
  const rename = useMutation({
    mutationFn: (v: { id: string; name: string }) => updateLabel(supabase, v.id, { name: v.name }),
    onSuccess: invalidate,
  });
  const recolor = useMutation({
    mutationFn: (v: { id: string; color: string }) => updateLabel(supabase, v.id, { color: v.color }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteLabel(supabase, id),
    onSuccess: invalidate,
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-lg bg-background p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">Labels</Dialog.Title>
            <Dialog.Close aria-label="Close">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          <ul className="space-y-2">
            {labels.map((l) => (
              <li key={l.id} className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label={`Colour for ${l.name}`}
                  value={l.color}
                  onChange={(e) => recolor.mutate({ id: l.id, color: e.target.value })}
                  className="h-6 w-6 rounded border border-border"
                />
                <input
                  aria-label={`Name for ${l.name}`}
                  defaultValue={l.name}
                  onBlur={(e) =>
                    e.target.value.trim() &&
                    e.target.value !== l.name &&
                    rename.mutate({ id: l.id, name: e.target.value.trim() })
                  }
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  aria-label={`Delete ${l.name}`}
                  onClick={() => remove.mutate(l.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2 border-t border-border pt-3">
            <select
              aria-label="New label colour"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            >
              {PROJECT_COLORS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New label name"
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
            />
            <Button type="button" size="sm" disabled={!name.trim()} onClick={() => add.mutate()}>
              Add label
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
