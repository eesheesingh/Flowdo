"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, type ProfileInput } from "@/lib/validations/auth";
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
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: initialFullName },
  });

  async function onSubmit(values: ProfileInput) {
    setSubmitError(null);
    setSuccess(false);
    const supabase = createClient();
    const { error } = await updateProfile(supabase, userId, { fullName: values.fullName });
    if (error) {
      setSubmitError(error);
      return;
    }
    setSuccess(true);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-sm space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fullName">Name</Label>
        <Input id="fullName" autoComplete="name" {...register("fullName")} />
        <FormError message={errors.fullName?.message} />
      </div>
      <FormError message={submitError ?? undefined} />
      {success && <p className="text-sm text-primary">Profile updated.</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
