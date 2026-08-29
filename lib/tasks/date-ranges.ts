export function getTodayRange(now: Date = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function isBefore(isoA: string, isoB: string): boolean {
  return new Date(isoA).getTime() < new Date(isoB).getTime();
}

export function isWithinRange(iso: string, start: string, end: string): boolean {
  const time = new Date(iso).getTime();
  return time >= new Date(start).getTime() && time < new Date(end).getTime();
}
