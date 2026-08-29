export default function TodayLoading() {
  return (
    <div className="space-y-6">
      <div className="h-6 w-24 animate-pulse rounded bg-muted" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    </div>
  );
}
