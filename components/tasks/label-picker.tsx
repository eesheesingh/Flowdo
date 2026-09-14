"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { listLabels } from "@/lib/labels/labels";
import { ManageLabelsDialog } from "@/components/labels/manage-labels-dialog";

export function LabelPicker({
  userId,
  value,
  onChange,
}: {
  userId: string;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const supabase = createClient();
  const [managing, setManaging] = React.useState(false);
  const { data: labels = [] } = useQuery({
    queryKey: ["labels"],
    queryFn: async () => (await listLabels(supabase)).data ?? [],
  });

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {labels.map((l) => {
          const on = value.includes(l.id);
          return (
            <button
              key={l.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(l.id)}
              className={
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors " +
                (on ? "text-white" : "bg-surface-container text-on-surface-variant hover:bg-surface-high")
              }
              style={on ? { backgroundColor: l.color } : undefined}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: on ? "rgba(255,255,255,0.8)" : l.color }} aria-hidden="true" />
              {l.name}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setManaging(true)}
          className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-1 text-xs text-on-surface-variant transition-colors hover:bg-surface-high"
        >
          <Plus className="h-3 w-3" /> New label
        </button>
      </div>
      {managing && <ManageLabelsDialog open userId={userId} onOpenChange={setManaging} />}
    </div>
  );
}
