"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { resendConfirmationEmail } from "@/lib/auth/verify";
import { canResend } from "@/lib/auth/resend-cooldown";
import { createClient } from "@/lib/supabase/client";

const COOLDOWN_MS = 30_000;

export function VerifyForm({ email }: { email: string }) {
  const [error, setError] = React.useState<string | null>(null);
  const [isResending, setIsResending] = React.useState(false);
  const [lastSentAt, setLastSentAt] = React.useState(() => Date.now());
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const resendAvailable = canResend(lastSentAt, now, COOLDOWN_MS);
  const secondsRemaining = Math.max(0, Math.ceil((lastSentAt + COOLDOWN_MS - now) / 1000));

  async function handleResend() {
    setError(null);
    setIsResending(true);
    const supabase = createClient();
    const { error } = await resendConfirmationEmail(supabase, email);
    setIsResending(false);
    if (error) {
      setError(error);
      return;
    }
    setLastSentAt(Date.now());
  }

  return (
    <div className="space-y-4 text-center">
      <FormError message={error ?? undefined} />
      {resendAvailable ? (
        <Button type="button" variant="ghost" onClick={handleResend} disabled={isResending}>
          {isResending ? "Sending…" : "Resend confirmation email"}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">Resend available in {secondsRemaining}s</p>
      )}
    </div>
  );
}
