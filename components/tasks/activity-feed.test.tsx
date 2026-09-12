import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ActivityFeed } from "./activity-feed";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/activity/activity", () => ({
  listActivity: vi.fn().mockResolvedValue({
    data: [
      { id: "a2", action: "task.completed", metadata: null, created_at: "2026-03-15T10:00:00Z" },
      { id: "a1", action: "task.created", metadata: { title: "X" }, created_at: "2026-03-15T09:00:00Z" },
    ],
    error: null,
  }),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => vi.clearAllMocks());

describe("ActivityFeed", () => {
  it("renders described activity lines newest first", async () => {
    wrap(<ActivityFeed taskId="t1" />);
    expect(await screen.findByText("Completed this task")).toBeInTheDocument();
    expect(screen.getByText('Created "X"')).toBeInTheDocument();
  });
});
