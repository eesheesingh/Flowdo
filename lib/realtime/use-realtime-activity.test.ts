import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRealtimeActivity } from "./use-realtime-activity";

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

describe("useRealtimeActivity", () => {
  it("subscribes to postgres_changes on activity_logs filtered by project_id when given", () => {
    renderHook(() => useRealtimeActivity("p1", vi.fn()));
    expect(channelFn).toHaveBeenCalledWith("activity-project-p1");
    expect(on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "flowdo", table: "activity_logs", filter: "project_id=eq.p1" },
      expect.any(Function)
    );
    expect(subscribe).toHaveBeenCalled();
  });

  it("does not subscribe when projectId is null", () => {
    renderHook(() => useRealtimeActivity(null, vi.fn()));
    expect(channelFn).not.toHaveBeenCalled();
  });

  it("calls the latest onChange when a change event fires", () => {
    const onChange = vi.fn();
    renderHook(() => useRealtimeActivity("p1", onChange));
    const handler = on.mock.calls[0]![2] as () => void;
    act(() => handler());
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("removes the channel on unmount", () => {
    const { unmount } = renderHook(() => useRealtimeActivity("p1", vi.fn()));
    unmount();
    expect(removeChannel).toHaveBeenCalledWith(channel);
  });
});
