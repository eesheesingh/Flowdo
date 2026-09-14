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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-12">
      <header className="flex flex-col gap-1">
        <h1 className="font-serif text-4xl tracking-tight text-on-surface sm:text-5xl">Calendar</h1>
        <p className="max-w-xl text-on-surface-variant">
          Click any day to see, add, or check off what&apos;s planned for it.
        </p>
      </header>
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
