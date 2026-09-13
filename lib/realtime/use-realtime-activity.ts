"use client";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export function useRealtimeActivity(projectId: string | null, onChange: () => void) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!projectId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`activity-project-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "flowdo", table: "activity_logs", filter: `project_id=eq.${projectId}` },
        () => onChangeRef.current()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);
}
