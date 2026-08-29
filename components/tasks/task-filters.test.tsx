import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskFilters } from "./task-filters";

describe("TaskFilters", () => {
  it("calls onChange with an updated search value after a debounce (not on every keystroke)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TaskFilters currentFilters={{}} onChange={onChange} projects={[]} />);

    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, "milk");
    expect(searchInput).toHaveValue("milk");

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ search: "milk" }));
    });
    // Debouncing should have coalesced the 4 keystrokes into a single call.
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("hides the status filter select when hideStatusFilter is true", () => {
    const onChange = vi.fn();
    render(<TaskFilters currentFilters={{}} onChange={onChange} projects={[]} hideStatusFilter />);
    expect(screen.queryByLabelText(/^status$/i)).not.toBeInTheDocument();
  });

  it("hides the manual order sort option when hideManualSort is true", () => {
    const onChange = vi.fn();
    render(<TaskFilters currentFilters={{}} onChange={onChange} projects={[]} hideManualSort />);
    expect(screen.queryByRole("option", { name: /manual order/i })).not.toBeInTheDocument();
  });

  it("calls onChange with the selected priority", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TaskFilters currentFilters={{}} onChange={onChange} projects={[]} />);

    await user.selectOptions(screen.getByLabelText(/priority/i), "HIGH");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ priority: "HIGH" }));
  });
});
