import { redirect } from "next/navigation";
import { Sparkles, ShieldCheck, Palette } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile/profile-form";
import { SecurityForm } from "./security/security-form";
import { ThemeToggle } from "@/components/theme-toggle";

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl bg-surface-lowest p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary-container text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-serif text-lg text-on-surface">{title}</h2>
          <p className="text-sm text-on-surface-variant">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-12">
      <header className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">Preferences</span>
        <h1 className="font-serif text-3xl text-on-surface">Settings</h1>
        <p className="text-on-surface-variant">Manage your account, security, and how FlowDo looks.</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SettingsSection icon={Sparkles} title="Profile" description="Your name and account email.">
          <ProfileForm userId={user.id} initialFullName={profile?.full_name ?? ""} email={user.email ?? ""} />
        </SettingsSection>

        <SettingsSection icon={ShieldCheck} title="Security" description="Update your password.">
          <SecurityForm />
        </SettingsSection>

        <SettingsSection
          icon={Palette}
          title="Appearance"
          description="Warm palettes crafted to prevent screen fatigue."
        >
          <ThemeToggle />
        </SettingsSection>
      </div>
    </div>
  );
}
