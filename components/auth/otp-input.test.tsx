import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OtpInput } from "./otp-input";

describe("OtpInput", () => {
  it("renders 6 digit boxes by default", () => {
    render(<OtpInput value="" onChange={() => {}} />);
    expect(screen.getAllByRole("textbox")).toHaveLength(6);
  });

  it("auto-advances focus and reports the combined value on typing", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    function Wrapper() {
      const [value, setValue] = useState("");
      return (
        <OtpInput
          value={value}
          onChange={(v: string) => {
            setValue(v);
            handleChange(v);
          }}
        />
      );
    }
    render(<Wrapper />);
    const boxes = screen.getAllByRole("textbox");
    await user.type(boxes[0]!, "1");
    await user.type(boxes[1]!, "2");
    expect(handleChange).toHaveBeenLastCalledWith("12");
  });

  it("fills all boxes from a pasted 6-digit code", async () => {
    const handleChange = vi.fn();
    render(<OtpInput value="" onChange={handleChange} />);
    const boxes = screen.getAllByRole("textbox");
    const clipboardData = { getData: () => "482913" };
    boxes[0]!.focus();
    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true }) as unknown as ClipboardEvent;
    Object.defineProperty(pasteEvent, "clipboardData", { value: clipboardData });
    boxes[0]!.dispatchEvent(pasteEvent);
    expect(handleChange).toHaveBeenCalledWith("482913");
  });
});
