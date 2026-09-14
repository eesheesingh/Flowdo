import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-surface-container-low/60 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-lowest shadow-xs">
        <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-on-surface">{title}</p>
        <p className="text-sm text-on-surface-variant">{description}</p>
      </div>
      {action}
    </div>
  );
}
