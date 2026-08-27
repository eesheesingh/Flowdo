"use client";
import * as React from "react";
import { updateProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";

export function ProfileForm({
  userId,
  initialFullName,
  email,
}: {
  userId: string;
  initialFullName: string;
  email: string;
}) {
  const [fullName, setFullName] = React.useState(initialFullName);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);
    const supabase = createClient();
    const { error } = await updateProfile(supabase, userId, { fullName });
    setIsSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    setSuccess(true);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fullName">Name</Label>
        <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <FormError message={error ?? undefined} />
      {success && <p className="text-sm text-primary">Profile updated.</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
