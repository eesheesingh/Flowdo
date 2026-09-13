import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemberList } from "./member-list";

const updateMemberRole = vi.fn().mockResolvedValue({ error: null });
const removeMember = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/projects/members", () => ({
  listMembers: vi.fn().mockResolvedValue({ data: [], error: null }),
  updateMemberRole: (...a: unknown[]) => updateMemberRole(...a),
  removeMember: (...a: unknown[]) => removeMember(...a),
}));
vi.mock("./invite-member-dialog", () => ({ InviteMemberDialog: () => null }));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const bob = {
  id: "m2", project_id: "p1", user_id: "u2", role: "MEMBER", created_at: "",
  profile: { full_name: "Bob", email: "bob@example.com", avatar_url: null },
};
const ada = {
  id: "owner-u1", project_id: "p1", user_id: "u1", role: "OWNER", created_at: "",
  profile: { full_name: "Ada", email: "ada@example.com", avatar_url: null },
};

describe("MemberList", () => {
  it("shows each member's display name and role badge", () => {
    wrap(<MemberList projectId="p1" currentUserRole="MEMBER" initialMembers={[ada, bob] as never} />);
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    expect(screen.getByText("Member")).toBeInTheDocument();
  });

  it("shows an empty state with no members", () => {
    wrap(<MemberList projectId="p1" currentUserRole="OWNER" initialMembers={[]} />);
    expect(screen.getByText("No members yet.")).toBeInTheDocument();
  });

  it("shows the invite button for an OWNER or ADMIN, not a MEMBER", () => {
    wrap(<MemberList projectId="p1" currentUserRole="OWNER" initialMembers={[]} />);
    expect(screen.getByRole("button", { name: /invite member/i })).toBeInTheDocument();
  });

  it("hides the invite button for a plain MEMBER", () => {
    wrap(<MemberList projectId="p1" currentUserRole="MEMBER" initialMembers={[]} />);
    expect(screen.queryByRole("button", { name: /invite member/i })).not.toBeInTheDocument();
  });

  it("lets a manager change a member's role via the select", async () => {
    const user = userEvent.setup();
    wrap(<MemberList projectId="p1" currentUserRole="OWNER" initialMembers={[bob] as never} />);
    await user.selectOptions(screen.getByLabelText("Role for Bob"), "ADMIN");
    expect(updateMemberRole).toHaveBeenCalledWith(expect.anything(), "p1", "u2", "ADMIN");
  });

  it("lets a manager remove a member", async () => {
    const user = userEvent.setup();
    wrap(<MemberList projectId="p1" currentUserRole="OWNER" initialMembers={[bob] as never} />);
    await user.click(screen.getByRole("button", { name: "Remove Bob" }));
    expect(removeMember).toHaveBeenCalledWith(expect.anything(), "p1", "u2");
  });

  it("does not show role controls for a plain MEMBER viewer", () => {
    wrap(<MemberList projectId="p1" currentUserRole="MEMBER" initialMembers={[bob] as never} />);
    expect(screen.queryByLabelText("Role for Bob")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Bob" })).not.toBeInTheDocument();
  });

  it("never shows role controls for the OWNER row itself", () => {
    wrap(<MemberList projectId="p1" currentUserRole="OWNER" initialMembers={[ada] as never} />);
    expect(screen.queryByLabelText("Role for Ada")).not.toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });
});
