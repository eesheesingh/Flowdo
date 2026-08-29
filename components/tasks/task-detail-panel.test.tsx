import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskDetailPanel } from "./task-detail-panel";

const baseTask = {
  id: "1",
  user_id: "u1",
  project_id: null,
  parent_task_id: null,
  title: "Write report",
  description: "Quarterly numbers",
  status: "TODO" as const,
  priority: "MEDIUM" as const,
  due_date: null,
  completed_at: null,
  position: 0,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("TaskDetailPanel", () => {
  it("prefills the form from the task and calls onSave with edited values", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskDetailPanel
        task={baseTask}
        projects={[]}
        open={true}
        onOpenChange={vi.fn()}
        onSave={onSave}
        onDelete={vi.fn()}
      />
    );

    const titleInput = screen.getByLabelText(/title/i);
    expect(titleInput).toHaveValue("Write report");

    await user.clear(titleInput);
    await user.type(titleInput, "Write final report");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(onSave).toHaveBeenCalledWith(
      "1",
      expect.objectContaining({ title: "Write final report" })
    );
  });

  it("calls onDelete when the delete button is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <TaskDetailPanel
        task={baseTask}
        projects={[]}
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={onDelete}
      />
    );
    await user.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith("1");
  });
});
