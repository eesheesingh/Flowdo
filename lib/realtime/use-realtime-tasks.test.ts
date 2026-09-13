import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRealtimeTasks } from "./use-realtime-tasks";

const on = vi.fn().mockReturnThis();
const subscribe = vi.fn().mockReturnThis();
const channel = { on, subscribe };
const channelFn = vi.fn().mockReturnValue(channel);
const removeChannel = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: (...a: unknown[]) => channelFn(...a),
    removeChannel: (...a: unknown[]) => removeChannel(...a),
  }),
}));

beforeEach(() => vi.clearAllMocks());

describe("useRealtimeTasks", () => {
  it("subscribes to postgres_changes filtered by project_id when a projectId is given", () => {
    renderHook(() => useRealtimeTasks("p1", vi.fn()));
    expect(channelFn).toHaveBeenCalledWith("tasks-project-p1");
    expect(on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "flowdo", table: "tasks", filter: "project_id=eq.p1" },
      expect.any(Function)
    );
    expect(subscribe).toHaveBeenCalled();
  });

  it("does not subscribe when projectId is null", () => {
    renderHook(() => useRealtimeTasks(null, vi.fn()));
    expect(channelFn).not.toHaveBeenCalled();
  });

  it("calls the latest onChange when a change event fires", () => {
    const onChange = vi.fn();
    renderHook(() => useRealtimeTasks("p1", onChange));
    const handler = on.mock.calls[0]![2] as () => void;
    act(() => handler());
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("removes the channel on unmount", () => {
    const { unmount } = renderHook(() => useRealtimeTasks("p1", vi.fn()));
    unmount();
    expect(removeChannel).toHaveBeenCalledWith(channel);
  });
});
