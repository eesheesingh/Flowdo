import { SecurityForm } from "./security-form";

export default function SecuritySettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Security</h1>
      <SecurityForm />
    </div>
  );
}
