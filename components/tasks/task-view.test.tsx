import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TaskView } from "./task-view";

const completeTask = vi.fn();

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/tasks/tasks", () => ({
  listTasks: vi.fn().mockResolvedValue({ data: [], error: null }),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  completeTask: (...a: unknown[]) => completeTask(...a),
  reopenTask: vi.fn(),
  updateTaskPosition: vi.fn(),
}));
vi.mock("@/lib/tasks/task-labels", () => ({ setTaskLabels: vi.fn() }));

const task = {
  id: "t1",
  user_id: "u1",
  project_id: null,
  parent_task_id: null,
  title: "Write report",
  description: null,
  status: "TODO" as const,
  priority: "MEDIUM" as const,
  due_date: null,
  completed_at: null,
  position: 0,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  completeTask.mockResolvedValue({ error: null });
});

describe("TaskView invalidate()", () => {
  it("invalidates both the task list and the task-labels-map after a mutation", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    render(
      <QueryClientProvider client={qc}>
        <TaskView
          initialTasks={[task]}
          projects={[]}
          labels={[]}
          userId="u1"
          baseFilters={{}}
          viewKey="inbox"
          emptyState={{
            default: { title: "d", description: "d" },
            filtered: { title: "f", description: "f" },
          }}
        />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /complete task/i }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["tasks", "inbox"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["task-labels-map", "inbox"] });
    });
  });
});
