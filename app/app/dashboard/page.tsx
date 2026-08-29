import { createClient } from "@/lib/supabase/server";
import { listTasks } from "@/lib/tasks/tasks";
import { listProjects } from "@/lib/projects/projects";
import { computeDashboardStats } from "@/lib/tasks/dashboard-stats";
import { getTodayRange } from "@/lib/tasks/date-ranges";
import { TaskList } from "@/components/tasks/task-list";
import { ProjectCard } from "@/components/projects/project-card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: allTasks }, { data: projects }] = await Promise.all([
    listTasks(supabase, {}),
    listProjects(supabase),
  ]);

  const stats = computeDashboardStats(allTasks ?? []);
  const { start, end } = getTodayRange();
  const todayTasks = (allTasks ?? []).filter(
    (t) => t.due_date !== null && t.due_date >= start && t.due_date < end
  );

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Hey, {firstName}</h1>
        <p className="text-sm text-muted-foreground">
          {stats.todayCompleted} of {stats.todayTotal} tasks done today
        </p>
      </div>

      {stats.overdueCount > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {stats.overdueCount} overdue {stats.overdueCount === 1 ? "task" : "tasks"}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Today</h2>
        <TaskList
          tasks={todayTasks}
          onOpenTask={() => {}}
          onToggleComplete={() => {}}
          emptyTitle="Nothing due today"
          emptyDescription="Enjoy the calm."
        />
      </div>

      {(projects ?? []).length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Projects</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(projects ?? []).slice(0, 3).map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                taskCount={(allTasks ?? []).filter((t) => t.project_id === project.id && t.status !== "COMPLETED").length}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
