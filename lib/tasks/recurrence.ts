export type Recurrence = "NEVER" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | "CUSTOM";
export type RecurrenceRule = { interval: number; unit: "day" | "week" | "month" | "year" };

function daysInMonth(year: number, monthIndex: number): number {
  // monthIndex may be out of 0-11 range; Date normalises it. Day 0 of month M+1 = last day of month M.
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addDays(current: Date, n: number): Date {
  return new Date(current.getTime() + n * 24 * 60 * 60 * 1000);
}

function addMonths(current: Date, n: number): Date {
  const y = current.getUTCFullYear();
  const m = current.getUTCMonth();
  const day = current.getUTCDate();
  const targetMonthDays = daysInMonth(y, m + n);
  return new Date(
    Date.UTC(
      y,
      m + n,
      Math.min(day, targetMonthDays),
      current.getUTCHours(),
      current.getUTCMinutes(),
      current.getUTCSeconds(),
      current.getUTCMilliseconds()
    )
  );
}

export function nextDueDate(
  current: Date,
  recurrence: Exclude<Recurrence, "NEVER">,
  rule: RecurrenceRule | null
): Date {
  switch (recurrence) {
    case "DAILY":
      return addDays(current, 1);
    case "WEEKLY":
      return addDays(current, 7);
    case "MONTHLY":
      return addMonths(current, 1);
    case "YEARLY":
      return addMonths(current, 12);
    case "CUSTOM": {
      if (!rule || rule.interval < 1) return addDays(current, 1);
      switch (rule.unit) {
        case "day":
          return addDays(current, rule.interval);
        case "week":
          return addDays(current, rule.interval * 7);
        case "month":
          return addMonths(current, rule.interval);
        case "year":
          return addMonths(current, rule.interval * 12);
      }
    }
  }
}
