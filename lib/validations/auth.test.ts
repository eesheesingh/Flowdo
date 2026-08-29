import { describe, it, expect } from "vitest";
import { signupSchema, loginSchema, resetPasswordSchema, profileSchema } from "./auth";

describe("signupSchema", () => {
  it("accepts a valid signup", () => {
    const result = signupSchema.safeParse({
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      password: "StrongPass123!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a short password", () => {
    const result = signupSchema.safeParse({
      fullName: "Ada",
      email: "ada@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = signupSchema.safeParse({
      fullName: "Ada",
      email: "not-an-email",
      password: "StrongPass123!",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("requires both email and password", () => {
    expect(loginSchema.safeParse({ email: "a@example.com", password: "" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("requires password and confirmPassword to match", () => {
    const result = resetPasswordSchema.safeParse({
      password: "StrongPass123!",
      confirmPassword: "Different123!",
    });
    expect(result.success).toBe(false);
  });
});

describe("profileSchema", () => {
  it("accepts a non-empty name", () => {
    expect(profileSchema.safeParse({ fullName: "Ada Lovelace" }).success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(profileSchema.safeParse({ fullName: "" }).success).toBe(false);
  });
});
