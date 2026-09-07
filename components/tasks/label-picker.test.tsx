import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LabelPicker } from "./label-picker";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/labels/labels", () => ({
  listLabels: vi.fn().mockResolvedValue({
    data: [{ id: "l1", name: "Work", color: "#4F46E5" }, { id: "l2", name: "Home", color: "#16A34A" }],
    error: null,
  }),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => vi.clearAllMocks());

describe("LabelPicker", () => {
  it("toggles a label id in and out of value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    wrap(<LabelPicker userId="u1" value={[]} onChange={onChange} />);
    await user.click(await screen.findByRole("button", { name: "Work" }));
    expect(onChange).toHaveBeenCalledWith(["l1"]);
  });

  it("shows a selected label as pressed", async () => {
    wrap(<LabelPicker userId="u1" value={["l2"]} onChange={() => {}} />);
    const home = await screen.findByRole("button", { name: "Home" });
    expect(home).toHaveAttribute("aria-pressed", "true");
  });
});
