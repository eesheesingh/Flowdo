import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickAdd } from "./quick-add";

describe("QuickAdd", () => {
  it("calls onCreate with the typed title and clears the input on Enter", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<QuickAdd onCreate={onCreate} />);

    const input = screen.getByPlaceholderText(/add a task/i);
    await user.type(input, "Buy milk{Enter}");

    expect(onCreate).toHaveBeenCalledWith("Buy milk");
    expect(input).toHaveValue("");
  });

  it("does not call onCreate for an empty/whitespace-only title", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<QuickAdd onCreate={onCreate} />);

    const input = screen.getByPlaceholderText(/add a task/i);
    await user.type(input, "   {Enter}");

    expect(onCreate).not.toHaveBeenCalled();
  });
});
