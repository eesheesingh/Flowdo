import { CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";

export default function CompletedPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Completed</h1>
      <EmptyState icon={CheckCircle2} title="No completed tasks yet" description="Tasks you finish will show up here." />
    </div>
  );
}
