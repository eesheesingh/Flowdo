import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrendChart } from "./trend-chart";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: (...a: unknown[]) => push(...a) }),
  useSearchParams: () => new URLSearchParams("period=daily"),
}));

describe("TrendChart", () => {
  it("marks the active period", () => {
    render(<TrendChart period="daily" data={[{ label: "Mar 1", count: 2 }]} />);
    expect(screen.getByRole("link", { name: "daily" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "weekly" })).not.toHaveAttribute("aria-current");
  });

  it("clicking a period link navigates with ?period=", () => {
    render(<TrendChart period="daily" data={[]} />);
    screen.getByRole("link", { name: "weekly" }).click();
    expect(push).toHaveBeenCalledWith("?period=weekly");
  });

  it("renders the underlying bar chart data", () => {
    render(<TrendChart period="daily" data={[{ label: "Mar 1", count: 2 }]} />);
    expect(screen.getByText("Mar 1")).toBeInTheDocument();
  });
});
