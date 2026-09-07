import type { ReactElement } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TaskDetailPanel } from "./task-detail-panel";

// Most tests here are form-focused and stub the subtask section to nothing.
// The "Enter in the subtask field" regression test flips `mockRealSubtask.on`
// to render the REAL <SubtaskSection>; its data layer is mocked below so no
// real Supabase client is built.
const mockRealSubtask = { on: false };
vi.mock("./subtask-section", async (orig) => {
  const actual = await orig<typeof import("./subtask-section")>();
  return {
    SubtaskSection: (props: { taskId: string; userId: string }) =>
      mockRealSubtask.on ? <actual.SubtaskSection {...props} /> : null,
  };
});
// Same pattern for the label picker: stubbed to nothing unless a test flips
// `mockRealLabelPicker.on`. Its own wiring is covered by label-picker.test.tsx.
const mockRealLabelPicker = { on: false };
vi.mock("./label-picker", async (orig) => {
  const actual = await orig<typeof import("./label-picker")>();
  return {
    LabelPicker: (props: { userId: string; value: string[]; onChange: (ids: string[]) => void }) =>
      mockRealLabelPicker.on ? <actual.LabelPicker {...props} /> : null,
  };
});
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/tasks/task-labels", () => ({
  listTaskLabels: vi.fn().mockResolvedValue({ data: [], error: null }),
  setTaskLabels: vi.fn().mockResolvedValue({ error: null }),
}));
vi.mock("@/lib/labels/labels", () => ({
  listLabels: vi.fn().mockResolvedValue({ data: [{ id: "l1", name: "Work", color: "#4F46E5" }], error: null }),
  createLabel: vi.fn(),
  updateLabel: vi.fn(),
  deleteLabel: vi.fn(),
}));
const createSubtask = vi.fn().mockResolvedValue({ data: { id: "s1", title: "x", status: "TODO" }, error: null });
vi.mock("@/lib/tasks/subtasks", async (orig) => ({
  ...(await orig<typeof import("@/lib/tasks/subtasks")>()),
  listSubtasks: vi.fn().mockResolvedValue({ data: [], error: null }),
  createSubtask: (...a: unknown[]) => createSubtask(...a),
}));
vi.mock("@/lib/tasks/tasks", () => ({
  completeTask: vi.fn().mockResolvedValue({ error: null }),
  reopenTask: vi.fn().mockResolvedValue({ error: null }),
  deleteTask: vi.fn().mockResolvedValue({ error: null }),
}));

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
  recurrence: "NEVER" as const,
  recurrence_rule: null,
};

// The panel now runs a useQuery for assigned labels, so every render needs a
// QueryClient in context.
function renderPanel(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("TaskDetailPanel", () => {
  it("prefills the form from the task and calls onSave with edited values", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderPanel(
      <TaskDetailPanel
        task={baseTask}
        projects={[]}
        userId="u1"

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
    renderPanel(
      <TaskDetailPanel
        task={baseTask}
        projects={[]}
        userId="u1"

        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={onDelete}
      />
    );
    await user.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith("1");
  });

  it("clears an assigned project to null (not undefined) when 'No project' is selected", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const taskWithProject = { ...baseTask, project_id: "11111111-1111-1111-1111-111111111111" };
    const projects = [
      {
        id: "11111111-1111-1111-1111-111111111111",
        owner_id: "u1",
        name: "Marketing",
        description: null,
        color: "#000000",
        icon: "folder",
        status: "ACTIVE" as const,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ];
    renderPanel(
      <TaskDetailPanel
        task={taskWithProject}
        projects={projects}
        userId="u1"

        open={true}
        onOpenChange={vi.fn()}
        onSave={onSave}
        onDelete={vi.fn()}
      />
    );

    await user.selectOptions(screen.getByLabelText(/project/i), "");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(onSave).toHaveBeenCalledWith("1", expect.objectContaining({ projectId: null }));
  });

  it("clears an existing due date to null (not undefined) when the date input is emptied", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const taskWithDueDate = { ...baseTask, due_date: "2026-02-01T00:00:00+00:00" };
    renderPanel(
      <TaskDetailPanel
        task={taskWithDueDate}
        projects={[]}
        userId="u1"

        open={true}
        onOpenChange={vi.fn()}
        onSave={onSave}
        onDelete={vi.fn()}
      />
    );

    const dueDateInput = screen.getByLabelText(/due date/i);
    await user.clear(dueDateInput);
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(onSave).toHaveBeenCalledWith("1", expect.objectContaining({ dueDate: null }));
  });

  it("prefills the due date input with just the YYYY-MM-DD portion of a timestamptz value (regression: full ISO timestamp renders as a blank native date input)", () => {
    const taskWithDueDate = { ...baseTask, due_date: "2026-02-01T00:00:00+00:00" };
    renderPanel(
      <TaskDetailPanel
        task={taskWithDueDate}
        projects={[]}
        userId="u1"

        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/due date/i)).toHaveValue("2026-02-01");
  });

  it("pressing Enter to add a subtask does not submit the panel form (regression: missing preventDefault)", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    mockRealSubtask.on = true;
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    try {
      render(
        <QueryClientProvider client={qc}>
          <TaskDetailPanel
            task={baseTask}
            projects={[]}
            userId="u1"
            open={true}
            onOpenChange={vi.fn()}
            onSave={onSave}
            onDelete={vi.fn()}
          />
        </QueryClientProvider>
      );

      await user.type(screen.getByPlaceholderText(/add a subtask/i), "New subtask{Enter}");

      expect(createSubtask).toHaveBeenCalledWith(expect.anything(), "u1", "1", "New subtask");
      expect(onSave).not.toHaveBeenCalled();
    } finally {
      mockRealSubtask.on = false;
    }
  });

  it("persists label assignments via onLabelsChange on save", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onLabelsChange = vi.fn().mockResolvedValue(undefined);
    mockRealLabelPicker.on = true;
    try {
      renderPanel(
        <TaskDetailPanel
          task={baseTask}
          projects={[]}
          userId="u1"
          open={true}
          onOpenChange={vi.fn()}
          onSave={onSave}
          onDelete={vi.fn()}
          onLabelsChange={onLabelsChange}
        />
      );

      await user.click(await screen.findByRole("button", { name: "Work" }));
      await user.click(screen.getByRole("button", { name: /save/i }));

      expect(onLabelsChange).toHaveBeenCalledWith("1", ["l1"]);
    } finally {
      mockRealLabelPicker.on = false;
    }
  });
});
