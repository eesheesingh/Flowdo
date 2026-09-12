import { createClient } from "@/lib/supabase/server";
import { listTasks } from "@/lib/tasks/tasks";
import { listProjects } from "@/lib/projects/projects";
import { listLabels } from "@/lib/labels/labels";
import { monthRange } from "@/lib/calendar/month";
import { MonthGrid } from "@/components/calendar/month-grid";

function parseMonth(param: string | undefined): { year: number; month: number } {
  const now = new Date();
  const m = /^(\d{4})-(\d{2})$/.exec(param ?? "");
  if (!m) return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  return { year: Number(m[1]), month: Number(m[2]) };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { year, month } = parseMonth(searchParams.month);
  const [{ data: tasks }, { data: projects }, { data: labels }] = await Promise.all([
    listTasks(supabase, { dueDateRange: monthRange(year, month), parentTaskId: null }),
    listProjects(supabase),
    listLabels(supabase),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Calendar</h1>
      <MonthGrid
        year={year}
        month={month}
        tasks={tasks ?? []}
        projects={projects ?? []}
        labels={labels ?? []}
        userId={user!.id}
      />
    </div>
  );
}
