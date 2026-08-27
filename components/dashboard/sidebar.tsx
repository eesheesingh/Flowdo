"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Calendar as CalendarIcon,
  CalendarDays,
  CheckCircle2,
  FolderKanban,
  BarChart3,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/inbox", label: "Inbox", icon: Inbox },
  { href: "/app/today", label: "Today", icon: CalendarIcon },
  { href: "/app/upcoming", label: "Upcoming", icon: CalendarDays },
  { href: "/app/completed", label: "Completed", icon: CheckCircle2 },
  { href: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/app/projects", label: "Projects", icon: FolderKanban },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/settings/profile", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="hidden w-56 shrink-0 flex-col gap-1 border-r border-border p-4 md:flex">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href.split("/").slice(0, 3).join("/"));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
              isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
