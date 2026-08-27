import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("renders a title and description", () => {
    render(<EmptyState icon={Inbox} title="No tasks yet" description="Create your first task to get started." />);
    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
    expect(screen.getByText("Create your first task to get started.")).toBeInTheDocument();
  });
});
