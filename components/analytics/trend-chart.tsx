"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart } from "./bar-chart";

const PERIODS = ["daily", "weekly", "monthly"] as const;
type Period = (typeof PERIODS)[number];

export function TrendChart({ data, period }: { data: { label: string; count: number }[]; period: Period }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function linkFor(p: Period): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", p);
    return `?${params.toString()}`;
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-1">
        {PERIODS.map((p) => (
          <a
            key={p}
            href={linkFor(p)}
            onClick={(e) => {
              e.preventDefault();
              router.push(linkFor(p));
            }}
            aria-current={p === period ? "true" : undefined}
            className={
              "rounded-md px-2 py-1 text-xs capitalize " +
              (p === period ? "bg-primary text-primary-foreground" : "border border-border")
            }
          >
            {p}
          </a>
        ))}
      </div>
      <BarChart title="Completion trend" data={data} />
    </div>
  );
}
