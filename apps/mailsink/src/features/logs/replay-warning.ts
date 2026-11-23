import type { PayloadFormat } from '@mailsink/contracts'

// `exact` replays resend the copied signature with its old timestamp (D139). Svix-based
// verifiers (the Resend SDK) reject a timestamp more than 5 minutes away from their clock;
// a unified receiver checking `X-Mailsink-Timestamp` may do the same. Brevo signs nothing.

export const SVIX_TOLERANCE_SECONDS = 5 * 60

/** Age in whole minutes of the copied signature when a verifier would reject it, else null. */
export function staleSignatureMinutes(
  format: PayloadFormat,
  signedAt: number | null,
  nowMs = Date.now(),
): number | null {
  if (format === 'brevo' || signedAt === null) return null
  const age = Math.floor(nowMs / 1000) - signedAt
  return age > SVIX_TOLERANCE_SECONDS ? Math.floor(age / 60) : null
}
