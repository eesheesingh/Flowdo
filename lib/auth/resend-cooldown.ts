export function canResend(lastSentAt: number, now: number, cooldownMs = 30_000): boolean {
  return now - lastSentAt >= cooldownMs;
}
