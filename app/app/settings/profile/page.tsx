import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Profile</h1>
      <ProfileForm userId={user.id} initialFullName={profile?.full_name ?? ""} email={user.email ?? ""} />
    </div>
  );
}
