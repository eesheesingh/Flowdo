import { createClient } from "@/lib/supabase/server";
import { listTasks } from "@/lib/tasks/tasks";
import { listProjects } from "@/lib/projects/projects";
import { computeDashboardStats } from "@/lib/tasks/dashboard-stats";
import { DashboardTodayList } from "./dashboard-today-list";
import { ProjectCard } from "@/components/projects/project-card";

// "Overdue" (any incomplete task with a due date before today) has no
// dedicated listTasks filter, so it still needs a broader scan than the
// today/none due-date filters provide. This cap bounds the worst case for a
// pathological account; it does not make the query a true O(1) count - see
// the fix-wave report for why a proper fix needs a dedicated count query.
const OVERDUE_SCAN_LIMIT = 500;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: todayTasks }, { data: overdueScanTasks }, { data: projects }] = await Promise.all([
    listTasks(supabase, { dueDate: "today" }),
    listTasks(supabase, { limit: OVERDUE_SCAN_LIMIT }),
    listProjects(supabase),
  ]);

  const { overdueCount } = computeDashboardStats(overdueScanTasks ?? []);
  const todayTotal = (todayTasks ?? []).length;
  const todayCompleted = (todayTasks ?? []).filter((t) => t.status === "COMPLETED").length;

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Hey, {firstName}</h1>
        <p className="text-sm text-muted-foreground">
          {todayCompleted} of {todayTotal} tasks done today
        </p>
      </div>

      {overdueCount > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {overdueCount} overdue {overdueCount === 1 ? "task" : "tasks"}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Today</h2>
        <DashboardTodayList tasks={todayTasks ?? []} />
      </div>

      {(projects ?? []).length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Projects</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(projects ?? []).slice(0, 3).map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                taskCount={(overdueScanTasks ?? []).filter((t) => t.project_id === project.id && t.status !== "COMPLETED").length}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
