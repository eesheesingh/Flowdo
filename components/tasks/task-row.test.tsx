import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskRow } from "./task-row";

const baseTask = {
  id: "1",
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

describe("TaskRow", () => {
  it("renders the title and calls onOpen when clicked", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<TaskRow task={baseTask} onOpen={onOpen} onToggleComplete={vi.fn()} />);
    await user.click(screen.getByText("Write report"));
    expect(onOpen).toHaveBeenCalledWith(baseTask);
  });

  it("calls onToggleComplete when the checkbox is clicked, without opening the task", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onToggleComplete = vi.fn();
    render(<TaskRow task={baseTask} onOpen={onOpen} onToggleComplete={onToggleComplete} />);
    await user.click(screen.getByRole("checkbox"));
    expect(onToggleComplete).toHaveBeenCalledWith(baseTask);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("shows a checked checkbox for a completed task", () => {
    render(
      <TaskRow
        task={{ ...baseTask, status: "COMPLETED", completed_at: "2026-01-02T00:00:00.000Z" }}
        onOpen={vi.fn()}
        onToggleComplete={vi.fn()}
      />
    );
    expect(screen.getByRole("checkbox")).toBeChecked();
  });
});
