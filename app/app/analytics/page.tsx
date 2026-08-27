import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Analytics</h1>
      <EmptyState icon={BarChart3} title="Not enough data yet" description="Productivity insights appear once you've completed some tasks." />
    </div>
  );
}
