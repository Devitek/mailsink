import { describe, expect, it } from 'vitest'
import type { RuntimeConfig } from '../../runtime/config'
import type { Runtime } from '../../runtime/container'
import { publicEndpoints } from './public-endpoints'

const runtime = (config: Partial<RuntimeConfig>, listening = 1025) =>
  ({
    config: { publicUrl: 'https://mail.example.com', smtpPort: 1025, ...config },
    smtpPort: listening,
  }) as Runtime

describe('publicEndpoints', () => {
  it('derives the SMTP host from the public URL and the port from the listener', () => {
    expect(publicEndpoints(runtime({}, 2601))).toEqual({
      publicUrl: 'https://mail.example.com',
      smtpHost: 'mail.example.com',
      smtpPort: 2601,
    })
  })

  it('falls back to the configured port when the listener reports none', () => {
    expect(publicEndpoints(runtime({ smtpPort: 2525 }, 0)).smtpPort).toBe(2525)
  })

  it('prefers MAILSINK_SMTP_PUBLIC_HOST / _PORT (port mapping, separate SMTP name)', () => {
    const endpoints = publicEndpoints(
      runtime({ smtpPublicHost: 'smtp.example.com', smtpPublicPort: 587 }, 1025),
    )
    expect(endpoints).toMatchObject({ smtpHost: 'smtp.example.com', smtpPort: 587 })
  })
})
