"use client";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export function useRealtimeTasks(projectId: string | null, onChange: () => void) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!projectId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`tasks-project-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "flowdo", table: "tasks", filter: `project_id=eq.${projectId}` },
        () => onChangeRef.current()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);
}
