import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TaskView } from "./task-view";

const completeTask = vi.fn();
const getTask = vi.fn();
const searchParamsMock = vi.fn(() => new URLSearchParams());

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => searchParamsMock(),
}));
vi.mock("@/lib/tasks/tasks", () => ({
  listTasks: vi.fn().mockResolvedValue({ data: [], error: null }),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  completeTask: (...a: unknown[]) => completeTask(...a),
  reopenTask: vi.fn(),
  updateTaskPosition: vi.fn(),
  getTask: (...a: unknown[]) => getTask(...a),
}));
vi.mock("@/lib/tasks/task-labels", () => ({ setTaskLabels: vi.fn() }));

const useRealtimeTasks = vi.fn();
vi.mock("@/lib/realtime/use-realtime-tasks", () => ({
  useRealtimeTasks: (...a: unknown[]) => useRealtimeTasks(...a),
}));

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
  recurrence: "NEVER" as const,
  recurrence_rule: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  completeTask.mockResolvedValue({ error: null });
  getTask.mockResolvedValue({ data: null, error: null });
  searchParamsMock.mockReturnValue(new URLSearchParams());
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

describe("TaskView ?task= deep link", () => {
  function renderView(initialTasks: typeof task[]) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <TaskView
          initialTasks={initialTasks}
          projects={[]}
          labels={[]}
          userId="u1"
          baseFilters={{}}
          viewKey="upcoming"
          emptyState={{
            default: { title: "d", description: "d" },
            filtered: { title: "f", description: "f" },
          }}
        />
      </QueryClientProvider>
    );
  }

  it("opens the task named by ?task= when it's already in the fetched list", async () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("task=t1"));
    renderView([task]);

    expect(await screen.findByDisplayValue(task.title)).toBeInTheDocument();
    expect(getTask).not.toHaveBeenCalled();
  });

  it("falls back to fetching the task directly when it's not in the current view", async () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("task=elsewhere"));
    getTask.mockResolvedValue({ data: { ...task, id: "elsewhere", title: "From elsewhere" }, error: null });
    renderView([task]);

    expect(await screen.findByDisplayValue("From elsewhere")).toBeInTheDocument();
    expect(getTask).toHaveBeenCalledWith({}, "elsewhere");
  });

  it("silently ignores a ?task= id that doesn't exist or isn't the caller's", async () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("task=missing"));
    getTask.mockResolvedValue({ data: null, error: "Task not found." });
    renderView([task]);

    await waitFor(() => expect(getTask).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("TaskView realtime", () => {
  it("subscribes to realtime task changes scoped to the view's projectId", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TaskView
          initialTasks={[]}
          projects={[]}
          labels={[]}
          userId="u1"
          baseFilters={{ projectId: "p1" }}
          viewKey="project-p1"
          emptyState={{
            default: { title: "d", description: "d" },
            filtered: { title: "f", description: "f" },
          }}
        />
      </QueryClientProvider>
    );
    expect(useRealtimeTasks).toHaveBeenCalledWith("p1", expect.any(Function));
  });

  it("passes null for a non-project-scoped view", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TaskView
          initialTasks={[]}
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
    expect(useRealtimeTasks).toHaveBeenCalledWith(null, expect.any(Function));
  });
});
