import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SubtaskSection } from "./subtask-section";

const listSubtasks = vi.fn();
const createSubtask = vi.fn();
const completeTask = vi.fn();
const reopenTask = vi.fn();
const deleteTask = vi.fn();

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/tasks/subtasks", async (orig) => ({
  ...(await orig<typeof import("@/lib/tasks/subtasks")>()),
  listSubtasks: (...a: unknown[]) => listSubtasks(...a),
  createSubtask: (...a: unknown[]) => createSubtask(...a),
}));
vi.mock("@/lib/tasks/tasks", () => ({
  completeTask: (...a: unknown[]) => completeTask(...a),
  reopenTask: (...a: unknown[]) => reopenTask(...a),
  deleteTask: (...a: unknown[]) => deleteTask(...a),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  listSubtasks.mockResolvedValue({
    data: [
      { id: "s1", title: "First", status: "COMPLETED" },
      { id: "s2", title: "Second", status: "TODO" },
    ],
    error: null,
  });
  createSubtask.mockResolvedValue({ data: { id: "s3", title: "Third", status: "TODO" }, error: null });
  completeTask.mockResolvedValue({ error: null });
  reopenTask.mockResolvedValue({ error: null });
});

describe("SubtaskSection", () => {
  it("shows progress as done/total with a bar", async () => {
    wrap(<SubtaskSection taskId="t1" userId="u1" />);
    expect(await screen.findByText("1 / 2 completed")).toBeInTheDocument();
  });

  it("adds a subtask via the inline input", async () => {
    const user = userEvent.setup();
    wrap(<SubtaskSection taskId="t1" userId="u1" />);
    await screen.findByText("1 / 2 completed");
    await user.type(screen.getByPlaceholderText(/add a subtask/i), "Third{Enter}");
    expect(createSubtask).toHaveBeenCalledWith(expect.anything(), "u1", "t1", "Third");
  });
});
