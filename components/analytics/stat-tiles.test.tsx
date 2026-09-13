import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatTiles } from "./stat-tiles";

describe("StatTiles", () => {
  it("renders all four values", () => {
    render(<StatTiles created={10} completed={4} completionRate={40} overdue={2} />);
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Completion rate")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("applies destructive styling to the overdue tile only when it's > 0", () => {
    render(<StatTiles created={10} completed={4} completionRate={40} overdue={0} />);
    expect(screen.getByText("0")).not.toHaveClass("text-destructive");
  });

  it("applies destructive styling when overdue is > 0", () => {
    render(<StatTiles created={10} completed={4} completionRate={40} overdue={3} />);
    expect(screen.getByText("3")).toHaveClass("text-destructive");
  });
});
