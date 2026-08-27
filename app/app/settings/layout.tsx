import Link from "next/link";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-border pb-2 text-sm">
        <Link href="/app/settings/profile" className="font-medium hover:text-primary">
          Profile
        </Link>
        <Link href="/app/settings/security" className="font-medium hover:text-primary">
          Security
        </Link>
      </div>
      {children}
    </div>
  );
}
