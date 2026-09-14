import { redirect } from "next/navigation";
import { Flame, CheckCircle2, ListTodo, FolderKanban, Settings } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listTasks, getCompletionStreak } from "@/lib/tasks/tasks";
import { listProjects } from "@/lib/projects/projects";
import { Button } from "@/components/ui/button";

function StatTile({ icon: Icon, value, label, tone }: { icon: React.ElementType; value: string | number; label: string; tone: "primary" | "secondary" }) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-xl bg-surface-container-low p-4 transition-colors hover:bg-surface-container">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-on-surface-variant">{label}</span>
        <span
          className={
            "rounded-lg p-1.5 " +
            (tone === "primary" ? "bg-primary/10 text-primary" : "bg-secondary-container text-on-secondary-fixed-variant")
          }
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <span className="font-serif text-3xl text-on-surface">{value}</span>
    </div>
  );
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, streak, { data: completedTasks }, { data: activeTasks }, { data: projects }] =
    await Promise.all([
      supabase.from("profiles").select("full_name, created_at").eq("id", user.id).single(),
      getCompletionStreak(supabase, user.id),
      listTasks(supabase, { parentTaskId: null, status: "COMPLETED" }),
      listTasks(supabase, { parentTaskId: null, excludeCompleted: true }),
      listProjects(supabase),
    ]);

  const name = profile?.full_name || user.email!.split("@")[0];
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-12">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">Your space</span>
          <h1 className="font-serif text-3xl text-on-surface">{name}</h1>
          <p className="mt-1 text-on-surface-variant">
            {memberSince ? `Member since ${memberSince} · ` : ""}
            {user.email}
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/app/settings">
            <Settings className="h-4 w-4" /> Settings
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Flame} value={streak} label="Day streak" tone="primary" />
        <StatTile icon={CheckCircle2} value={completedTasks?.length ?? 0} label="Completed" tone="secondary" />
        <StatTile icon={ListTodo} value={activeTasks?.length ?? 0} label="Active tasks" tone="primary" />
        <StatTile icon={FolderKanban} value={projects?.length ?? 0} label="Lists" tone="secondary" />
      </div>
    </div>
  );
}
