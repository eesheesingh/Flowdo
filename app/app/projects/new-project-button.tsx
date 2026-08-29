"use client";
import { useRouter } from "next/navigation";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { createProject } from "@/lib/projects/projects";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { ProjectInput } from "@/lib/validations/tasks";

export function NewProjectButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleCreate(input: ProjectInput) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await createProject(supabase, user.id, input);
    router.refresh();
  }

  return (
    <ProjectFormDialog
      trigger={
        <Button>
          <Plus className="mr-2 h-4 w-4" /> New project
        </Button>
      }
      onCreate={handleCreate}
    />
  );
}
