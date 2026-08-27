import { FolderKanban } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Projects</h1>
      <EmptyState icon={FolderKanban} title="No projects yet" description="Create a project to organize your tasks." />
    </div>
  );
}
