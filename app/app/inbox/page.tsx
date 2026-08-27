import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";

export default function InboxPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Inbox</h1>
      <EmptyState icon={Inbox} title="Inbox is empty" description="Unassigned tasks will land here." />
    </div>
  );
}
