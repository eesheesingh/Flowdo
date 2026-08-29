"use client";
import { useRouter } from "next/navigation";
import { archiveProject } from "@/lib/projects/projects";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function ArchiveProjectButton({ projectId, isArchived }: { projectId: string; isArchived: boolean }) {
  const router = useRouter();
  const supabase = createClient();

  if (isArchived) return null;

  async function handleArchive() {
    await archiveProject(supabase, projectId);
    router.refresh();
  }

  return (
    <Button type="button" variant="ghost" onClick={handleArchive}>
      Archive
    </Button>
  );
}
