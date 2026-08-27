import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";

export default function UpcomingPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Upcoming</h1>
      <EmptyState icon={CalendarDays} title="No upcoming tasks" description="Tasks due soon will show up here." />
    </div>
  );
}
