"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Inbox,
  Sun,
  Clock,
  CalendarDays,
  CheckCircle2,
  Settings,
  Flame,
  Plus,
  LayoutDashboard,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FlowDoMark } from "@/components/brand/flowdo-mark";
import { NewProjectButton } from "@/app/app/projects/new-project-button";

export const NAV_ITEMS = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/today", label: "Today", icon: Sun },
  { href: "/app/inbox", label: "Inbox", icon: Inbox },
  { href: "/app/upcoming", label: "Upcoming", icon: Clock },
  { href: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/app/completed", label: "Completed", icon: CheckCircle2 },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

const PRIMARY_NAV = [
  { href: "/app/today", label: "Today", icon: Sun },
  { href: "/app/inbox", label: "Inbox", icon: Inbox },
  { href: "/app/upcoming", label: "Upcoming", icon: Clock },
  { href: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/app/completed", label: "Completed", icon: CheckCircle2 },
];

const SECONDARY_NAV = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
];

export interface SidebarProject {
  id: string;
  name: string;
  color: string;
}

export function Sidebar({
  projects,
  todayCount,
  inboxCount,
  streak,
  userName,
  userEmail,
}: {
  projects: SidebarProject[];
  todayCount: number;
  inboxCount: number;
  streak: number;
  userName: string;
  userEmail: string;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const counts: Record<string, number> = { "/app/today": todayCount, "/app/inbox": inboxCount };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col justify-between bg-surface-lowest p-4 shadow-sm md:flex">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
        <Link href="/app/today" className="flex items-center gap-2 px-1 pt-1">
          <FlowDoMark className="h-8 w-8 shrink-0" />
          <div className="flex flex-col leading-none">
            <span className="font-serif text-lg text-on-surface">FlowDo</span>
            <span className="text-[11px] italic text-on-surface-variant">Find your flow.</span>
          </div>
        </Link>

        <nav className="flex flex-col gap-0.5">
          {PRIMARY_NAV.map((item) => {
            const active = isActive(item.href);
            const count = counts[item.href];
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-secondary-container font-medium text-on-secondary-fixed-variant"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                )}
              >
                <span className="flex items-center gap-2">
                  <item.icon className="h-[18px] w-[18px]" strokeWidth={2} />
                  {item.label}
                </span>
                {!!count && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[11px] font-medium",
                      active ? "bg-primary-fixed text-on-primary-fixed" : "bg-surface-container text-on-surface-variant"
                    )}
                  >
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <nav className="flex flex-col gap-0.5 border-t border-outline-variant/50 pt-2">
          {SECONDARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                isActive(item.href)
                  ? "bg-surface-container text-on-surface"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              )}
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-1 pt-1">
          <div className="flex items-center justify-between px-3 pb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
              Organize
            </span>
            <NewProjectButtonSlot />
          </div>
          <div className="flex flex-col gap-0.5">
            {projects.map((project) => {
              const href = `/app/projects/${project.id}`;
              const active = isActive(href);
              return (
                <Link
                  key={project.id}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-secondary-container font-medium text-on-secondary-fixed-variant"
                      : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  )}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
                  <span className="truncate">{project.name}</span>
                </Link>
              );
            })}
            {projects.length === 0 && (
              <Link href="/app/projects" className="px-3 py-1.5 text-xs text-on-surface-variant hover:text-on-surface">
                No lists yet — create one
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-2">
        {streak > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-surface-container px-3 py-2">
            <Flame className="h-[18px] w-[18px] shrink-0 text-tertiary" />
            <span className="text-xs font-medium text-on-surface">
              {streak} day{streak === 1 ? "" : "s"} streak
            </span>
          </div>
        )}
        <Link
          href="/app/profile"
          className={cn(
            "flex items-center gap-2 rounded-xl bg-surface-container-low px-3 py-2 transition-colors hover:bg-surface-container",
            isActive("/app/profile") && "bg-surface-container"
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-medium text-primary-foreground">
            {(userName || userEmail).charAt(0).toUpperCase()}
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-medium text-on-surface">{userName || "Your account"}</span>
            <span className="truncate text-xs text-on-surface-variant">{userEmail}</span>
          </span>
        </Link>
      </div>
    </aside>
  );
}

function NewProjectButtonSlot() {
  return (
    <NewProjectButton
      trigger={
        <button
          type="button"
          className="rounded-md p-0.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
          aria-label="New list"
        >
          <Plus className="h-4 w-4" />
        </button>
      }
    />
  );
}
