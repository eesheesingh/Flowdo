import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listTasks } from "@/lib/tasks/tasks";
import { listReadKeys } from "@/lib/notifications/notifications";
import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { UserMenu } from "@/components/dashboard/user-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: bellTasks }, { data: readKeys }] = await Promise.all([
    listTasks(supabase, { excludeCompleted: true, parentTaskId: null, hasDueDate: true, limit: 200 }),
    listReadKeys(supabase),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <MobileNav />
            <span className="font-semibold">FlowDo</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell tasks={bellTasks ?? []} readKeys={readKeys ?? []} userId={user.id} />
            <UserMenu email={user.email ?? ""} />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
