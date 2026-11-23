import { isMailsinkError } from '@devitek/mailsink'
import { describeDb } from '@mailsink/db/testing'
import { afterEach, expect, it, vi } from 'vitest'
import { connectWorkspace, createEphemeralWorkspace, mailsinkGlobalSetup } from '../src'
import '../src/setup'
import { ADMIN_KEY, sendTo, useHarness } from './support'

const activation = '<p>Hi Ada,</p><a href="https://app.example.com/activate?code=42">Activate</a>'

describeDb('ephemeral workspace and matchers', (ctx) => {
  const h = useHarness(ctx)
  const gone = (id: string) =>
    h.admin.admin.workspaces.get(id).then(
      () => false,
      (e: unknown) => isMailsinkError(e, 'not_found'),
    )
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('creates an ephemeral workspace from the environment and deletes it once', async () => {
    vi.stubEnv('MAILSINK_URL', h.server.url)
    vi.stubEnv('MAILSINK_ADMIN_KEY', ADMIN_KEY)
    const workspace = await createEphemeralWorkspace({ workspace: { name: 'Acme signup' } })
    const detail = await h.admin.admin.workspaces.get(workspace.workspace.id)
    expect(detail).toMatchObject({ name: 'Acme signup', ephemeral: true })
    expect(detail.metadata).toEqual({ createdBy: '@devitek/mailsink-vitest' })
    expect(detail.connections.map((c) => [c.kind, c.name])).toEqual([['resend', 'Test']])
    expect(workspace.credentials('resend').apiKey).toMatch(/^msk_/)
    expect(() => workspace.credentials('smtp')).toThrow('no smtp connection')

    await Promise.all([workspace.dispose(), workspace.dispose()])
    expect(await gone(workspace.workspace.id)).toBe(true)
    await workspace.dispose()
  })

  it('fails early without a URL or an admin key', async () => {
    vi.stubEnv('MAILSINK_URL', '')
    await expect(createEphemeralWorkspace({ adminKey: ADMIN_KEY })).rejects.toThrow('MAILSINK_URL')
    await expect(createEphemeralWorkspace({ url: h.server.url })).rejects.toThrow(
      'MAILSINK_ADMIN_KEY',
    )
  })

  it('asserts on received emails, their links and statuses', async () => {
    const workspace = await createEphemeralWorkspace({ url: h.server.url, adminKey: ADMIN_KEY })
    try {
      await expect(workspace).not.toHaveReceivedEmail()
      const id = await sendTo(workspace, {
        to: 'ada@example.test',
        subject: 'Activate your Acme account',
        html: activation,
      })
      // Sent before the assertion: every message of the workspace counts.
      await expect(workspace).toHaveReceivedEmail({ to: 'ada@example.test', subject: 'Activate' })
      await expect(workspace.client).not.toHaveReceivedEmail({ to: 'grace@example.test' })
      await expect(
        expect(workspace).toHaveReceivedEmail({ to: 'grace@example.test' }, { timeout: 300 }),
      ).rejects.toThrow(/within 300 ms\n[\s\S]*"Activate your Acme account" to ada@example\.test/)

      const message = await workspace.client.messages.get(id)
      expect(message).toHaveLink('/activate?code=42')
      expect(message).not.toHaveLink('/unsubscribe')
      expect(message).not.toHaveStatus(['hard_bounce', 'complained'])

      await workspace.client.messages.triggerEvent(id, { type: 'status', status: 'hard_bounce' })
      await expect(workspace).toHaveReceivedEmail({ status: ['hard_bounce'] })
      const bounced = await workspace.client.messages.get(id)
      expect(bounced).toHaveStatus('hard_bounce')
      expect(bounced).toHaveStatus('hard_bounce', { recipient: 'ada@example.test' })
    } finally {
      await workspace.dispose()
    }
  })

  it('global setup provides the workspace and deletes it at teardown', async () => {
    const provide = vi.fn()
    const teardown = await mailsinkGlobalSetup({
      url: h.server.url,
      adminKey: ADMIN_KEY,
      workspace: { name: 'Acme CI' },
    })({ provide })
    expect(provide).toHaveBeenCalledWith('mailsink', expect.objectContaining({ url: h.server.url }))
    const data = provide.mock.calls[0]?.[1]
    expect(structuredClone(data)).toEqual(data)
    const workspace = connectWorkspace(data)
    expect(workspace.workspace.name).toBe('Acme CI')
    await sendTo(workspace, { to: 'grace@example.test', subject: 'Your Acme invoice' })
    await expect(workspace).toHaveReceivedEmail({ subject: 'invoice' })
    await workspace.dispose() // a connected handle does not delete
    expect(await gone(workspace.workspace.id)).toBe(false)

    await teardown()
    expect(await gone(workspace.workspace.id)).toBe(true)
  })
})
