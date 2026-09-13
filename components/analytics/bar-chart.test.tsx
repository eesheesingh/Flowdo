import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BarChart } from "./bar-chart";

describe("BarChart", () => {
  it("renders each row's label and count, with bar widths proportional to the max", () => {
    render(
      <BarChart
        title="By project"
        data={[
          { label: "Inbox", count: 4 },
          { label: "Launch", count: 2 },
        ]}
      />
    );
    expect(screen.getByText("By project")).toBeInTheDocument();
    expect(screen.getByText("Inbox")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Launch")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    const bars = document.querySelectorAll(".bg-primary");
    expect((bars[0] as HTMLElement).style.width).toBe("100%");
    expect((bars[1] as HTMLElement).style.width).toBe("50%");
  });

  it("shows an empty state when data is empty", () => {
    render(<BarChart title="By project" data={[]} />);
    expect(screen.getByText("No data yet")).toBeInTheDocument();
  });

  it("shows an empty state when every count is zero", () => {
    render(
      <BarChart
        title="By priority"
        data={[
          { label: "LOW", count: 0 },
          { label: "HIGH", count: 0 },
        ]}
      />
    );
    expect(screen.getByText("No data yet")).toBeInTheDocument();
  });
});
