import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InviteMemberDialog } from "./invite-member-dialog";

const inviteMemberByEmail = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/projects/members", () => ({
  inviteMemberByEmail: (...a: unknown[]) => inviteMemberByEmail(...a),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => vi.clearAllMocks());

describe("InviteMemberDialog", () => {
  it("submits the email and selected role, then closes", async () => {
    inviteMemberByEmail.mockResolvedValue({ data: { id: "m1" }, error: null });
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    wrap(<InviteMemberDialog projectId="p1" open onOpenChange={onOpenChange} />);

    await user.type(screen.getByPlaceholderText("person@example.com"), "friend@example.com");
    await user.selectOptions(screen.getByLabelText("Role"), "ADMIN");
    await user.click(screen.getByRole("button", { name: /send invite/i }));

    expect(inviteMemberByEmail).toHaveBeenCalledWith(expect.anything(), "p1", "friend@example.com", "ADMIN");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows the human error and keeps the dialog open when the email has no account", async () => {
    inviteMemberByEmail.mockResolvedValue({ data: null, error: "No FlowDo account found with that email." });
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    wrap(<InviteMemberDialog projectId="p1" open onOpenChange={onOpenChange} />);

    await user.type(screen.getByPlaceholderText("person@example.com"), "nobody@example.com");
    await user.click(screen.getByRole("button", { name: /send invite/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/no flowdo account/i);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
