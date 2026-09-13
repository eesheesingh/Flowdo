export function StatTiles({
  created,
  completed,
  completionRate,
  overdue,
}: {
  created: number;
  completed: number;
  completionRate: number;
  overdue: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="space-y-1 rounded-lg border border-border p-4">
        <p className="text-xs text-muted-foreground">Created</p>
        <p className="text-2xl font-semibold">{created}</p>
      </div>
      <div className="space-y-1 rounded-lg border border-border p-4">
        <p className="text-xs text-muted-foreground">Completed</p>
        <p className="text-2xl font-semibold">{completed}</p>
      </div>
      <div className="space-y-1 rounded-lg border border-border p-4">
        <p className="text-xs text-muted-foreground">Completion rate</p>
        <p className="text-2xl font-semibold">{completionRate}%</p>
      </div>
      <div className="space-y-1 rounded-lg border border-border p-4">
        <p className="text-xs text-muted-foreground">Overdue</p>
        <p className={"text-2xl font-semibold" + (overdue > 0 ? " text-destructive" : "")}>{overdue}</p>
      </div>
    </div>
  );
}
