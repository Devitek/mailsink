import type { ChaosSmtpCode } from './draw'

/** An SMTP rejection, shaped like the `responseCode` errors of smtp-server (#31). */
export interface SmtpReply {
  responseCode: number
  /** Enhanced status code and text, without the basic code. */
  message: string
}

const CHAOS_TEXT: Record<ChaosSmtpCode, string> = {
  421: '4.3.2 Service not available',
  451: '4.3.0 Local error in processing',
  452: '4.3.1 Insufficient system storage',
  550: '5.7.1 Message rejected',
}

/** Reply of an SMTP command failed by chaos (#25), e.g. `452 4.3.1 … (chaos injected)`. */
export function chaosSmtpReply(code: ChaosSmtpCode): SmtpReply {
  return { responseCode: code, message: `${CHAOS_TEXT[code]} (chaos injected)` }
}
