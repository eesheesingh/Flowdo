import { redirect } from "next/navigation";

export default function ProfileSettingsRedirect() {
  redirect("/app/settings");
}
