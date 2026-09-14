import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listTasks, getCompletionStreak } from "@/lib/tasks/tasks";
import { listProjects } from "@/lib/projects/projects";
import { listReadKeys } from "@/lib/notifications/notifications";
import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { UserMenu } from "@/components/dashboard/user-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { HeaderAddTaskButton } from "@/components/tasks/header-add-task-button";
import { SearchCommand } from "@/components/search/search-command";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: bellTasks }, { data: readKeys }, { data: projects }, { data: profile }, streak, { data: todayTasks }, { data: inboxTasks }] =
    await Promise.all([
      listTasks(supabase, { excludeCompleted: true, parentTaskId: null, hasDueDate: true, limit: 200 }),
      listReadKeys(supabase),
      listProjects(supabase),
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
      getCompletionStreak(supabase, user.id),
      listTasks(supabase, { excludeCompleted: true, parentTaskId: null, dueDate: "today" }),
      listTasks(supabase, { excludeCompleted: true, parentTaskId: null, projectId: null }),
    ]);

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar
        projects={(projects ?? []).map((p) => ({ id: p.id, name: p.name, color: p.color }))}
        todayCount={(todayTasks ?? []).length}
        inboxCount={(inboxTasks ?? []).length}
        streak={streak}
        userName={profile?.full_name ?? ""}
        userEmail={user.email ?? ""}
      />
      <div className="flex flex-1 flex-col md:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 bg-surface/80 px-4 shadow-sm backdrop-blur-xl sm:px-6">
          <div className="flex flex-1 items-center gap-2">
            <MobileNav />
            <SearchCommand />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <HeaderAddTaskButton userId={user.id} />
            <NotificationBell tasks={bellTasks ?? []} readKeys={readKeys ?? []} userId={user.id} />
            <UserMenu email={user.email ?? ""} />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
