// The workspace lifecycle and the test session against the real routes of the app (the
// SDK test server), on both drivers, with the delivery simulation worker on.
import { isMailsinkError } from '@devitek/mailsink'
import { describeDb } from '@mailsink/db/testing'
import { expect, it } from 'vitest'
import { ADMIN_KEY } from '../../../apps/mailsink/src/http/test-fixtures'
import { useHarness } from '../../sdk/test/harness'
import { mailsinkMatchers } from '../src/matchers'
import { resolveWorkspaceOptions } from '../src/options'
import { resetWorkspace } from '../src/reset'
import { createTestSession } from '../src/session'
import { type ProvisionedWorkspace, provisionWorkspace } from '../src/workspace'

const state = (isNot = false) => ({ isNot, timeout: 5_000 })

describeDb('Playwright helpers: workspace and session', (ctx) => {
  const h = useHarness(ctx, { worker: true })

  const provision = () =>
    provisionWorkspace(
      resolveWorkspaceOptions(
        {
          connections: [
            { kind: 'resend', name: 'app' },
            { kind: 'smtp', name: 'mailer' },
          ],
        },
        { workerIndex: 3, env: { MAILSINK_URL: h.server.url, MAILSINK_ADMIN_KEY: ADMIN_KEY } },
      ),
    )

  async function send(ws: ProvisionedWorkspace, email: Record<string, unknown>) {
    const response = await fetch(`${ws.url}/v1/emails`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ws.env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: 'App <app@example.com>',
        to: 'jane@example.com',
        text: 'Hello',
        ...email,
      }),
    })
    if (!response.ok) throw new Error(`send: ${response.status} ${await response.text()}`)
    return ((await response.json()) as { id: string }).id
  }

  it('provisions an ephemeral workspace with its .env, and deletes it once', async () => {
    const ws = await provision()
    const detail = await ws.admin.admin.workspaces.get(ws.id)
    expect(detail).toMatchObject({ ephemeral: true, idleTtlSeconds: 600 })
    expect(detail.metadata).toEqual({ createdBy: 'playwright · worker 3' })
    expect(ws.env.RESEND_API_KEY).toMatch(/^msk_/)
    expect(ws.env.RESEND_BASE_URL).toMatch(/^https?:\/\//)
    expect(ws.env.SMTP_USER).toMatch(/\S/)
    expect(ws.connection('mailer').kind).toBe('smtp')

    await ws.dispose()
    const gone = await ws.admin.admin.workspaces.get(ws.id).catch((e: unknown) => e)
    expect(isMailsinkError(gone, 'not_found')).toBe(true)
    await ws.dispose() // already gone: fine
  })

  it('expectEmail sees emails since the test start and explains a timeout', async () => {
    const ws = await provision()
    try {
      await send(ws, { subject: 'Before the test' })
      const { client } = createTestSession(ws, new Date())
      await send(ws, { subject: 'Welcome', html: '<a href="https://app.example.com/c?t=1">x</a>' })
      const email = await client.expectEmail({ to: 'jane@example.com' })
      expect(email.subject).toBe('Welcome')
      expect(mailsinkMatchers.toHaveLink.call(state(), email, '/c?t=1').pass).toBe(true)
      expect(mailsinkMatchers.toHaveLink.call(state(), email, '/reset').pass).toBe(false)
      expect(mailsinkMatchers.toHaveAttachment.call(state(), email, 'a.pdf').pass).toBe(false)
      // Answered right after storage: the simulation delivers it a moment later.
      const status = await mailsinkMatchers.toHaveStatus.call(state(), email, 'delivered')
      expect(status.pass).toBe(true)

      const error = await client
        .expectEmail({ subject: 'Never' }, { timeout: 300 })
        .catch((e: Error) => e)
      expect(String(error)).toContain('no email matched {"subject":"Never"} within 300 ms')
      expect(String(error)).toContain('to jane@example.com: "Welcome" [delivered]')
      expect(String(error)).not.toContain('Before the test')
    } finally {
      await ws.dispose()
    }
  }, 20_000)

  it('withOverride lasts until the teardown; resetWorkspace clears everything', async () => {
    const ws = await provision()
    try {
      const session = createTestSession(ws, new Date())
      const connectionId = ws.connection('app').id
      await session.client.withOverride({ rates: { failed: 100 } })
      await session.client.withOverride({ rates: { deferred: 100 } }, { connectionId })
      const inside = await session.client.withOverride({ latency: { minMs: 0, maxMs: 0 } }, () =>
        ws.client.overrides.get(),
      )
      expect(inside.workspace?.config).toMatchObject({ latency: { minMs: 0, maxMs: 0 } })
      // The callback form resets its scope: the workspace one, here.
      expect((await ws.client.overrides.get()).workspace).toBeNull()
      expect((await ws.client.overrides.get()).connections).toHaveLength(1)
      await session.teardown()
      expect(await ws.client.overrides.get()).toMatchObject({ workspace: null, connections: [] })

      await ws.client.overrides.activate({ rules: [{ match: '*', status: 'hard_bounce' }] })
      const smtpId = ws.connection('mailer').id
      await ws.client.overrides.activate({ rates: { failed: 100 } }, { connectionId: smtpId })
      const id = await send(ws, { to: 'bounce@example.com', subject: 'Bounce' })
      await ws.client.messages.waitFor({ status: ['hard_bounce'] }, { since: new Date(0) })
      expect((await ws.client.suppressions.list()).total).toBe(1)
      await resetWorkspace(ws.client)
      expect(await ws.client.overrides.get()).toMatchObject({ workspace: null, connections: [] })
      expect((await ws.client.suppressions.list()).total).toBe(0)
      expect((await ws.client.messages.list()).data.map((m) => m.id)).not.toContain(id)
    } finally {
      await ws.dispose()
    }
  }, 20_000)
})
