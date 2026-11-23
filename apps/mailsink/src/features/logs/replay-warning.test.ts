import { describe, expect, it } from 'vitest'
import { staleSignatureMinutes } from './replay-warning'

describe('exact replay timestamp warning', () => {
  const now = 1_795_430_400_000
  const seconds = now / 1000

  it('warns once the copied timestamp is past the Svix tolerance', () => {
    expect(staleSignatureMinutes('resend', seconds - 299, now)).toBeNull()
    expect(staleSignatureMinutes('resend', seconds - 301, now)).toBe(5)
    expect(staleSignatureMinutes('unified', seconds - 3600, now)).toBe(60)
  })

  it('never warns for Brevo nor without an attempt', () => {
    expect(staleSignatureMinutes('brevo', seconds - 3600, now)).toBeNull()
    expect(staleSignatureMinutes('resend', null, now)).toBeNull()
  })
})
