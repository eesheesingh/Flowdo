export type DayCell = { date: string; inMonth: boolean };

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Monday-first index: Mon=0 … Sun=6
function mondayIndex(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

export function buildMonthGrid(year: number, month: number): DayCell[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const gridStart = new Date(first);
  gridStart.setUTCDate(first.getUTCDate() - mondayIndex(first));

  const lastOfMonth = new Date(Date.UTC(year, month, 0));
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setUTCDate(lastOfMonth.getUTCDate() + (6 - mondayIndex(lastOfMonth)));

  const weeks: DayCell[][] = [];
  const cursor = new Date(gridStart);
  while (cursor.getTime() <= gridEnd.getTime()) {
    const week: DayCell[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: ymd(cursor), inMonth: cursor.getUTCMonth() === month - 1 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export function monthRange(year: number, month: number): { start: string; end: string } {
  const grid = buildMonthGrid(year, month);
  const firstDate = grid[0]![0]!.date;
  const lastDate = grid[grid.length - 1]![6]!.date;
  const end = new Date(lastDate + "T00:00:00.000Z");
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: `${firstDate}T00:00:00.000Z`, end: end.toISOString() };
}
