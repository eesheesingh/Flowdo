import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecurrenceField } from "./recurrence-field";

describe("RecurrenceField", () => {
  it("is disabled with a hint when there is no due date", () => {
    render(<RecurrenceField value={{ recurrence: "NEVER", rule: null }} onChange={() => {}} hasDueDate={false} />);
    expect(screen.getByLabelText("Repeat")).toBeDisabled();
    expect(screen.getByText(/add a due date/i)).toBeInTheDocument();
  });

  it("reveals interval inputs when Custom is chosen", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RecurrenceField value={{ recurrence: "NEVER", rule: null }} onChange={onChange} hasDueDate />);
    await user.selectOptions(screen.getByLabelText("Repeat"), "CUSTOM");
    expect(onChange).toHaveBeenCalledWith({ recurrence: "CUSTOM", rule: { interval: 1, unit: "week" } });
  });

  it("emits a preset with a null rule", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RecurrenceField value={{ recurrence: "NEVER", rule: null }} onChange={onChange} hasDueDate />);
    await user.selectOptions(screen.getByLabelText("Repeat"), "MONTHLY");
    expect(onChange).toHaveBeenCalledWith({ recurrence: "MONTHLY", rule: null });
  });
});
