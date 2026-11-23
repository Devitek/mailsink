import { ConnectionInput } from '@mailsink/contracts'
import { describe, expect, it } from 'vitest'
import { connectionDefaults, connectionSchema, toConnectionInput } from './connection-form'

const m = { nameTooLong: 'long', usernameInvalid: 'user', rateInvalid: 'rate' }

describe('new connection form', () => {
  it('names a blank connection after its kind and drops the SMTP fields of API kinds', () => {
    const input = toConnectionInput({ ...connectionDefaults('brevo'), smtpUsername: 'ignored' })
    expect(input).toEqual({ kind: 'brevo', name: 'brevo' })
    expect(ConnectionInput.parse(input)).toEqual(input)
  })

  it('keeps the SMTP username and the rate limit override', () => {
    const input = toConnectionInput({
      kind: 'smtp',
      name: ' Relay ',
      smtpUsername: 'qa.relay',
      rateLimit: '5',
    })
    expect(ConnectionInput.parse(input)).toEqual({
      kind: 'smtp',
      name: 'Relay',
      smtpUsername: 'qa.relay',
      rateLimit: { limit: 5, windowSeconds: 1 },
    })
  })

  it('checks the username only for SMTP', () => {
    const schema = connectionSchema(m)
    const smtp = { ...connectionDefaults('smtp'), smtpUsername: 'a b' }
    expect(schema.safeParse(smtp).error?.issues.map((i) => i.message)).toEqual(['user'])
    expect(schema.safeParse({ ...smtp, kind: 'resend' }).success).toBe(true)
    expect(schema.safeParse({ ...smtp, smtpUsername: '', rateLimit: 'x' }).success).toBe(false)
  })
})
