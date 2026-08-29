import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskFilters } from "./task-filters";

describe("TaskFilters", () => {
  it("calls onChange with an updated search value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TaskFilters currentFilters={{}} onChange={onChange} projects={[]} />);

    await user.type(screen.getByPlaceholderText(/search/i), "milk");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ search: "milk" }));
  });

  it("calls onChange with the selected priority", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TaskFilters currentFilters={{}} onChange={onChange} projects={[]} />);

    await user.selectOptions(screen.getByLabelText(/priority/i), "HIGH");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ priority: "HIGH" }));
  });
});
