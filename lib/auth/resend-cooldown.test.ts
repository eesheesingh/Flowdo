import { describe, it, expect } from "vitest";
import { canResend } from "./resend-cooldown";

describe("canResend", () => {
  it("blocks resend immediately after sending", () => {
    expect(canResend(1000, 1000)).toBe(false);
  });

  it("blocks resend before the cooldown elapses", () => {
    expect(canResend(1000, 1000 + 29_000, 30_000)).toBe(false);
  });

  it("allows resend once the cooldown elapses", () => {
    expect(canResend(1000, 1000 + 30_000, 30_000)).toBe(true);
  });
});
