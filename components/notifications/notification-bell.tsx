"use client";
import * as React from "react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { useRouter } from "next/navigation";
import { Bell, AlertTriangle, Clock, ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { deriveNotifications, type DerivedNotification } from "@/lib/notifications/derive";
import { markRead, markAllRead } from "@/lib/notifications/notifications";
import type { Database } from "@/types/database";

type TaskRow = Database["flowdo"]["Tables"]["tasks"]["Row"];

const ICON = { overdue: AlertTriangle, "due-soon": Clock, "daily-summary": ListChecks } as const;

export function NotificationBell({
  tasks,
  readKeys,
  userId,
}: {
  tasks: TaskRow[];
  readKeys: string[];
  userId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  // Local optimistic dismissal set layered on top of the server-provided readKeys.
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());
  const allRead = React.useMemo(() => new Set([...readKeys, ...dismissed]), [readKeys, dismissed]);
  const items = React.useMemo(() => deriveNotifications(tasks, allRead, new Date()), [tasks, allRead]);

  async function openItem(n: DerivedNotification) {
    setDismissed((s) => new Set(s).add(n.key));
    await markRead(supabase, userId, [n]);
    if (n.taskId) router.push("/app/upcoming");
    router.refresh();
  }

  async function clearAll() {
    setDismissed((s) => new Set([...s, ...items.map((i) => i.key)]));
    await markAllRead(supabase, userId, items);
    router.refresh();
  }

  const count = items.length;

  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button
          aria-label={count > 0 ? `${count} unread notifications` : "Notifications"}
          className="relative rounded-md p-1.5 hover:bg-muted"
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {count}
            </span>
          )}
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content align="end" sideOffset={8}
          className="z-50 w-80 rounded-md border border-border bg-background p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-sm font-medium">Notifications</span>
            {count > 0 && (
              <button type="button" onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground">
                Mark all read
              </button>
            )}
          </div>
          {count === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((n) => {
                const Icon = ICON[n.type];
                return (
                  <li key={n.key}>
                    <button type="button" onClick={() => openItem(n)}
                      className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-muted">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{n.title}</span>
                        <span className="block text-xs text-muted-foreground">{n.message}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
