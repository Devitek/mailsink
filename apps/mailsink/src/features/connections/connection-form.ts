import type { ConnectionInput, ConnectionKind } from '@mailsink/contracts'
import { z } from 'zod'
import { rateLimitOf } from '../workspaces/workspace-form'

// Values, validation and request mapping of the « New connection » form (#38). The SMTP
// username only exists for `smtp`; the rate limit override applies to every kind (one token
// per SMTP transaction), empty = inherit the workspace limit.

export type ConnectionValues = {
  kind: ConnectionKind
  name: string
  smtpUsername: string
  rateLimit: string
}

export const connectionDefaults = (kind: ConnectionKind = 'resend'): ConnectionValues => ({
  kind,
  name: '',
  smtpUsername: '',
  rateLimit: '',
})

export type ConnectionMessages = {
  nameTooLong: string
  usernameInvalid: string
  rateInvalid: string
}

export const connectionSchema = (m: ConnectionMessages) =>
  z
    .object({
      kind: z.enum(['resend', 'brevo', 'smtp']),
      name: z.string().trim().max(80, m.nameTooLong),
      smtpUsername: z.string(),
      rateLimit: z.string().regex(/^\s*([1-9]\d{0,5})?\s*$/, m.rateInvalid),
    })
    .superRefine((values, ctx) => {
      const user = values.smtpUsername
      if (values.kind === 'smtp' && user !== '' && !/^[a-zA-Z0-9._-]{3,64}$/.test(user)) {
        ctx.addIssue({ code: 'custom', message: m.usernameInvalid, path: ['smtpUsername'] })
      }
    })

/** A blank name becomes the kind (`resend`, `smtp`…); a blank username is generated. */
export function toConnectionInput(values: ConnectionValues): ConnectionInput {
  const name = values.name.trim() || values.kind
  const rateLimit = rateLimitOf(values.rateLimit)
  const settings = { name, ...(rateLimit ? { rateLimit } : {}) }
  if (values.kind !== 'smtp') return { kind: values.kind, ...settings }
  const user = values.smtpUsername
  return { kind: 'smtp', ...settings, ...(user ? { smtpUsername: user } : {}) }
}
