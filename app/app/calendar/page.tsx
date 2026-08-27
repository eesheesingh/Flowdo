import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Calendar</h1>
      <EmptyState icon={CalendarDays} title="Calendar view coming soon" description="Task scheduling by date arrives in Phase 3." />
    </div>
  );
}
