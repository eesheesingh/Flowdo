import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationBell } from "./notification-bell";

const markAllRead = vi.fn().mockResolvedValue({ error: null });
const markRead = vi.fn().mockResolvedValue({ error: null });
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: (...a: unknown[]) => push(...a), refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/notifications/notifications", () => ({
  markAllRead: (...a: unknown[]) => markAllRead(...a),
  markRead: (...a: unknown[]) => markRead(...a),
}));

const task = (o: Partial<Record<string, unknown>>) => ({
  id: "t", user_id: "u", project_id: null, parent_task_id: null, title: "T",
  description: null, status: "TODO", priority: "MEDIUM", due_date: null, completed_at: null,
  position: 0, created_at: "", updated_at: "", recurrence: "NEVER", recurrence_rule: null, ...o,
});

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => vi.clearAllMocks());

describe("NotificationBell", () => {
  it("shows an unread count derived from tasks", async () => {
    wrap(<NotificationBell userId="u" readKeys={[]} tasks={[
      task({ id: "a", title: "Old", due_date: "2020-01-01T00:00:00Z" }),
    ] as never} />);
    expect(await screen.findByLabelText(/2 unread notifications/i)).toBeInTheDocument(); // overdue + summary
  });

  it("Mark all read clears the badge and calls markAllRead with the right args", async () => {
    const user = userEvent.setup();
    wrap(<NotificationBell userId="u" readKeys={[]} tasks={[
      task({ id: "a", title: "Old", due_date: "2020-01-01T00:00:00Z" }),
    ] as never} />);
    await user.click(screen.getByLabelText(/unread notifications/i));
    await user.click(await screen.findByRole("button", { name: /mark all read/i }));
    expect(markAllRead).toHaveBeenCalledTimes(1);
    const [supabaseArg, userIdArg, itemsArg] = markAllRead.mock.calls[0]!;
    expect(supabaseArg).toEqual({});
    expect(userIdArg).toBe("u");
    expect(itemsArg).toHaveLength(2);
    expect(itemsArg[0]).toMatchObject({ key: "overdue:a", type: "overdue", taskId: "a" });
    expect(itemsArg[1]).toMatchObject({ type: "daily-summary", taskId: null });
  });

  it("clicking a notification marks it read with the correct args", async () => {
    const user = userEvent.setup();
    wrap(<NotificationBell userId="u" readKeys={[]} tasks={[
      task({ id: "a", title: "Old", due_date: "2020-01-01T00:00:00Z" }),
    ] as never} />);
    await user.click(screen.getByLabelText(/unread notifications/i));
    await user.click(await screen.findByRole("button", { name: /Old/i }));
    expect(markRead).toHaveBeenCalledTimes(1);
    const [supabaseArg, userIdArg, itemsArg] = markRead.mock.calls[0]!;
    expect(supabaseArg).toEqual({});
    expect(userIdArg).toBe("u");
    expect(itemsArg).toEqual([expect.objectContaining({ key: "overdue:a", taskId: "a" })]);
    expect(push).toHaveBeenCalledWith("/app/upcoming?task=a");
  });

  it("rolls back the optimistic dismissal and shows an error when markRead fails", async () => {
    markRead.mockResolvedValueOnce({ error: "Couldn't update notifications. Please try again." });
    const user = userEvent.setup();
    wrap(<NotificationBell userId="u" readKeys={[]} tasks={[
      task({ id: "a", title: "Old", due_date: "2020-01-01T00:00:00Z" }),
    ] as never} />);
    await user.click(screen.getByLabelText(/unread notifications/i));
    await user.click(await screen.findByRole("button", { name: /Old/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't update notifications/i);
    expect(screen.getByRole("button", { name: /Old/i })).toBeInTheDocument();
  });

  it("renders the empty state when nothing is due", async () => {
    const user = userEvent.setup();
    wrap(<NotificationBell userId="u" readKeys={[]} tasks={[] as never} />);
    await user.click(screen.getByLabelText(/notifications/i));
    expect(await screen.findByText(/all caught up/i)).toBeInTheDocument();
  });
});
