"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { listActivity } from "@/lib/activity/activity";
import { describeActivity } from "@/lib/activity/format";
import { useRealtimeActivity } from "@/lib/realtime/use-realtime-activity";

function relative(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

export function ActivityFeed({ taskId, projectId }: { taskId?: string; projectId?: string }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const queryKey = ["activity", taskId ? "task" : "project", taskId ?? projectId];
  const { data: rows = [] } = useQuery({
    queryKey,
    queryFn: async () => (await listActivity(supabase, { taskId, projectId })).data ?? [],
  });

  useRealtimeActivity(taskId ? null : projectId ?? null, () => {
    queryClient.invalidateQueries({ queryKey });
  });

  return (
    <section className="space-y-2">
      <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">Activity</span>
      {rows.length === 0 ? (
        <p className="text-xs text-on-surface-variant">No activity yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 text-xs text-on-surface">
              <span>{describeActivity(r)}</span>
              <span className="shrink-0 text-on-surface-variant">{relative(r.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
