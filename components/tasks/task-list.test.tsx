import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskList } from "./task-list";

const tasks = [
  {
    id: "1",
    user_id: "u1",
    project_id: null,
    parent_task_id: null,
    title: "First",
    description: null,
    status: "TODO" as const,
    priority: "MEDIUM" as const,
    due_date: null,
    completed_at: null,
    position: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "2",
    user_id: "u1",
    project_id: null,
    parent_task_id: null,
    title: "Second",
    description: null,
    status: "TODO" as const,
    priority: "MEDIUM" as const,
    due_date: null,
    completed_at: null,
    position: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

describe("TaskList", () => {
  it("renders a drag handle on each row when onReorder is provided", () => {
    render(
      <TaskList
        tasks={tasks}
        onOpenTask={vi.fn()}
        onToggleComplete={vi.fn()}
        onReorder={vi.fn()}
        emptyTitle="Empty"
        emptyDescription="Nothing here"
      />
    );
    expect(screen.getAllByLabelText(/drag to reorder/i)).toHaveLength(2);
  });

  it("renders no drag handles when onReorder is omitted (e.g. Completed view)", () => {
    render(
      <TaskList
        tasks={tasks}
        onOpenTask={vi.fn()}
        onToggleComplete={vi.fn()}
        emptyTitle="Empty"
        emptyDescription="Nothing here"
      />
    );
    expect(screen.queryByLabelText(/drag to reorder/i)).not.toBeInTheDocument();
  });

  it("still shows the empty state when there are no tasks", () => {
    render(
      <TaskList
        tasks={[]}
        onOpenTask={vi.fn()}
        onToggleComplete={vi.fn()}
        onReorder={vi.fn()}
        emptyTitle="No tasks"
        emptyDescription="Add one above"
      />
    );
    expect(screen.getByText("No tasks")).toBeInTheDocument();
  });
});
