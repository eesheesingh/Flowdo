import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemberList } from "./member-list";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/projects/members", () => ({
  listMembers: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("MemberList", () => {
  it("shows each member's display name and role badge", () => {
    wrap(
      <MemberList
        projectId="p1"
        currentUserRole="OWNER"
        initialMembers={[
          {
            id: "owner-u1", project_id: "p1", user_id: "u1", role: "OWNER", created_at: "",
            profile: { full_name: "Ada Lovelace", email: "ada@example.com", avatar_url: null },
          },
          {
            id: "m2", project_id: "p1", user_id: "u2", role: "MEMBER", created_at: "",
            profile: { full_name: null, email: "bob@example.com", avatar_url: null },
          },
        ] as never}
      />
    );
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    expect(screen.getByText("Member")).toBeInTheDocument();
  });

  it("shows an empty state with no members", () => {
    wrap(<MemberList projectId="p1" currentUserRole="OWNER" initialMembers={[]} />);
    expect(screen.getByText("No members yet.")).toBeInTheDocument();
  });
});
