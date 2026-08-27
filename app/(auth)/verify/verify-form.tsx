"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { verifyOtpCode, resendOtpCode } from "@/lib/auth/verify";
import { canResend } from "@/lib/auth/resend-cooldown";
import { createClient } from "@/lib/supabase/client";

const COOLDOWN_MS = 30_000;

export function VerifyForm({ email }: { email: string }) {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isResending, setIsResending] = React.useState(false);
  const [lastSentAt, setLastSentAt] = React.useState(() => Date.now());
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const resendAvailable = canResend(lastSentAt, now, COOLDOWN_MS);
  const secondsRemaining = Math.max(0, Math.ceil((lastSentAt + COOLDOWN_MS - now) / 1000));

  async function handleVerify() {
    setError(null);
    setIsVerifying(true);
    const supabase = createClient();
    const { error } = await verifyOtpCode(supabase, email, code);
    setIsVerifying(false);
    if (error) {
      setError(error);
      return;
    }
    router.push("/app/dashboard");
  }

  async function handleResend() {
    setError(null);
    setIsResending(true);
    const supabase = createClient();
    const { error } = await resendOtpCode(supabase, email);
    setIsResending(false);
    if (error) {
      setError(error);
      return;
    }
    setLastSentAt(Date.now());
  }

  return (
    <div className="space-y-6">
      <OtpInput value={code} onChange={setCode} disabled={isVerifying} />
      <FormError message={error ?? undefined} />
      <Button className="w-full" disabled={code.length !== 6 || isVerifying} onClick={handleVerify}>
        {isVerifying ? "Verifying…" : "Verify"}
      </Button>
      <div className="text-center text-sm text-muted-foreground">
        {resendAvailable ? (
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"
          >
            {isResending ? "Sending…" : "Resend code"}
          </button>
        ) : (
          <span>Resend available in {secondsRemaining}s</span>
        )}
      </div>
    </div>
  );
}
