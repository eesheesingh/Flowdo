import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ManageLabelsDialog } from "./manage-labels-dialog";

const listLabels = vi.fn();
const createLabel = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/labels/labels", () => ({
  listLabels: (...a: unknown[]) => listLabels(...a),
  createLabel: (...a: unknown[]) => createLabel(...a),
  updateLabel: vi.fn().mockResolvedValue({ data: {}, error: null }),
  deleteLabel: vi.fn().mockResolvedValue({ error: null }),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  listLabels.mockResolvedValue({ data: [{ id: "l1", name: "Work", color: "#4F46E5" }], error: null });
  createLabel.mockResolvedValue({ data: { id: "l2", name: "Home", color: "#16A34A" }, error: null });
});

describe("ManageLabelsDialog", () => {
  it("lists existing labels", async () => {
    wrap(<ManageLabelsDialog open userId="u1" onOpenChange={() => {}} />);
    expect(await screen.findByDisplayValue("Work")).toBeInTheDocument();
  });

  it("creates a label from the add row", async () => {
    const user = userEvent.setup();
    wrap(<ManageLabelsDialog open userId="u1" onOpenChange={() => {}} />);
    await screen.findByDisplayValue("Work");
    await user.type(screen.getByPlaceholderText(/new label name/i), "Home");
    await user.click(screen.getByRole("button", { name: /add label/i }));
    expect(createLabel).toHaveBeenCalledWith(expect.anything(), "u1", { name: "Home", color: expect.any(String) });
  });
});
