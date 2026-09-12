import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MonthGrid } from "./month-grid";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const task = (over: Partial<Record<string, unknown>>) => ({
  id: "t1", user_id: "u1", project_id: null, parent_task_id: null, title: "Demo",
  description: null, status: "TODO", priority: "MEDIUM", due_date: "2026-03-10T09:00:00.000Z",
  completed_at: null, position: 0, created_at: "", updated_at: "", recurrence: "NEVER", recurrence_rule: null,
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe("MonthGrid", () => {
  it("renders 6 weeks for March 2026 and places a task on the 10th", () => {
    wrap(<MonthGrid year={2026} month={3} tasks={[task({}) as never]} projects={[]} labels={[]} userId="u1" />);
    expect(screen.getAllByRole("row")).toHaveLength(6);
    expect(screen.getByText("Demo")).toBeInTheDocument();
  });

  it("prev/next links navigate by month", async () => {
    wrap(<MonthGrid year={2026} month={3} tasks={[]} projects={[]} labels={[]} userId="u1" />);
    screen.getByRole("link", { name: /previous month/i }).click();
    expect(push).toHaveBeenCalledWith("?month=2026-02");
    screen.getByRole("link", { name: /next month/i }).click();
    expect(push).toHaveBeenCalledWith("?month=2026-04");
  });
});
