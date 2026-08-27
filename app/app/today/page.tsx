import { Calendar } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";

export default function TodayPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Today</h1>
      <EmptyState icon={Calendar} title="Nothing due today" description="Tasks due today will show up here." />
    </div>
  );
}
