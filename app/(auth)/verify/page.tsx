import Link from "next/link";
import { VerifyForm } from "./verify-form";

export default function VerifyPage({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  const email = searchParams.email ?? "";

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>. Click it to
          activate your account.
        </p>
      </div>
      <VerifyForm email={email} />
      <p className="text-center text-sm text-muted-foreground">
        Wrong email?{" "}
        <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
          Start over
        </Link>
      </p>
    </div>
  );
}
