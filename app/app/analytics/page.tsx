import { createClient } from "@/lib/supabase/server";
import { getAnalyticsSnapshot } from "@/lib/analytics/analytics";
import { listProjects } from "@/lib/projects/projects";
import {
  countByStatus,
  completionRate,
  countOverdue,
  groupByProject,
  groupByPriority,
  bucketCompletionTrend,
} from "@/lib/analytics/aggregate";
import { StatTiles } from "@/components/analytics/stat-tiles";
import { BarChart } from "@/components/analytics/bar-chart";
import { TrendChart } from "@/components/analytics/trend-chart";

const PERIODS = ["daily", "weekly", "monthly"] as const;
type Period = (typeof PERIODS)[number];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const supabase = await createClient();
  const [{ data: tasks }, { data: projects }] = await Promise.all([
    getAnalyticsSnapshot(supabase),
    listProjects(supabase, { includeArchived: true }),
  ]);

  const rows = tasks ?? [];
  const now = new Date();
  const { created, completed } = countByStatus(rows);
  const rate = completionRate(created, completed);
  const overdue = countOverdue(rows, now);
  const byProject = groupByProject(rows, projects ?? []);
  const byPriority = groupByPriority(rows);

  const periodParam = Array.isArray(searchParams.period) ? searchParams.period[0] : searchParams.period;
  const period: Period = (PERIODS as readonly string[]).includes(periodParam ?? "")
    ? (periodParam as Period)
    : "daily";
  const trend = bucketCompletionTrend(rows, period, now);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Analytics</h1>
      <StatTiles created={created} completed={completed} completionRate={rate} overdue={overdue} />
      <div className="grid gap-4 md:grid-cols-2">
        <BarChart title="Tasks by project" data={byProject} />
        <BarChart title="Tasks by priority" data={byPriority} />
      </div>
      <TrendChart period={period} data={trend} />
    </div>
  );
}
