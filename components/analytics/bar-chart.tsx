export function BarChart({ data, title }: { data: { label: string; count: number }[]; title: string }) {
  const max = Math.max(0, ...data.map((d) => d.count));
  const hasData = data.length > 0 && max > 0;

  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      {!hasData ? (
        <p className="text-xs text-muted-foreground">No data yet</p>
      ) : (
        <ul className="space-y-2">
          {data.map((row) => (
            <li key={row.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span>{row.label}</span>
                <span className="text-muted-foreground">{row.count}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${Math.round((row.count / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
