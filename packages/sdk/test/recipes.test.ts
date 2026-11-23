// The recipes of the package README, run against the in-process server with the delivery
// simulation worker on.
import { describeDb } from '@mailsink/db/testing'
import { expect, it } from 'vitest'
import { extractCode, findLink } from '../src'
import { useHarness } from './harness'

describeDb('SDK README recipes', (ctx) => {
  const h = useHarness(ctx, { worker: true })

  it('magic link: wait for the email, then follow its link', async () => {
    const mailsink = h.sink
    const email = mailsink.messages.waitFor({ to: 'jane@example.com', subject: 'Sign in' })
    await h.send({
      to: 'jane@example.com',
      subject: 'Sign in to Acme',
      html: '<a href="https://app.example.com/auth/magic?token=t0k3n&amp;next=%2F">Sign in</a>',
    })
    const link = findLink(await email, '/auth/magic')
    expect(link).toBe('https://app.example.com/auth/magic?token=t0k3n&next=%2F')
  })

  it('one-time code: read the 6-digit code', async () => {
    const since = new Date()
    await h.send({ to: 'otp@example.com', subject: 'Your code', text: 'Your code is 731904.' })
    const email = await h.sink.messages.waitFor({ to: 'otp@example.com' }, { since })
    expect(extractCode(email)).toBe('731904')
  })

  it('bounce: send under an override, wait for the simulated status', async () => {
    const rules = [{ match: 'bounce@example.com', status: 'hard_bounce' as const }]
    const bounced = await h.sink.overrides.with({ rules }, async () => {
      const since = new Date()
      await h.send({ to: 'bounce@example.com', subject: 'Will bounce' })
      return h.sink.messages.waitFor(
        { to: 'bounce@example.com', status: ['hard_bounce'] },
        { since, timeout: 15_000 },
      )
    })
    expect(bounced.recipients[0]).toMatchObject({ status: 'hard_bounce' })
    const listed = await h.sink.suppressions.list({ email: 'bounce@example.com' })
    expect(listed.total).toBe(1)
    expect((await h.sink.overrides.get()).workspace).toBeNull()
  }, 20_000)
})
