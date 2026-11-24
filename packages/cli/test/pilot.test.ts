// The piloting commands against the real HTTP routes (SDK test harness), on both drivers.
import { describeDb } from '@mailsink/db/testing'
import { expect, it } from 'vitest'
import { ADMIN_KEY } from '../../../apps/mailsink/src/http/test-fixtures'
import { useHarness } from '../../sdk/test/harness'
import { EXIT, run } from '../src/index'

async function cli(argv: string[], env: Record<string, string | undefined>) {
  const out: string[] = []
  const err: string[] = []
  const code = await run(argv, env, { out: (l) => out.push(l), err: (l) => err.push(l) })
  return { code, out: out.join('\n'), err: err.join('\n') }
}

const json = <T>(text: string) => JSON.parse(text) as T

describeDb('mailsink piloting commands', (ctx) => {
  const h = useHarness(ctx)
  const admin = () => ({ MAILSINK_URL: h.server.url, MAILSINK_ADMIN_KEY: ADMIN_KEY })
  const sink = () => ({ MAILSINK_URL: h.server.url, MAILSINK_KEY: h.workspaceKey })

  it('creates an ephemeral workspace and prints its credentials as .env lines', async () => {
    const created = await cli(
      ['workspace', 'create', '--ephemeral', '--ttl', '1h', '--connection', 'resend:app'],
      admin(),
    )
    expect(created.code).toBe(EXIT.ok)
    const env = Object.fromEntries(created.out.split('\n').map((l) => l.split(/=(.*)/s)))
    expect(env.MAILSINK_URL).toBe(h.server.url)
    expect(env.MAILSINK_KEY).toMatch(/^mskw_/)
    expect(env.RESEND_API_KEY).toMatch(/^msk_/)
    expect(env.RESEND_BASE_URL).toBeTruthy()

    const listed = await cli(['workspace', 'list', '--ephemeral', '--json'], admin())
    const ids = json<{ id: string }[]>(listed.out).map((w) => w.id)
    expect(ids).toContain(env.MAILSINK_WORKSPACE_ID)
    const persistent = await cli(['workspace', 'list', '--json'], admin())
    expect(json<{ id: string }[]>(persistent.out).map((w) => w.id)).not.toContain(
      env.MAILSINK_WORKSPACE_ID,
    )
    const table = await cli(['workspace', 'list', '--ephemeral'], admin())
    expect(table.out).toMatch(/^ID\s+SLUG\s+EPHEMERAL/)
    expect(table.out).toContain(env.MAILSINK_WORKSPACE_SLUG)

    const deleted = await cli(['workspace', 'delete', env.MAILSINK_WORKSPACE_SLUG ?? ''], admin())
    expect(deleted).toMatchObject({ code: EXIT.ok, out: /Deleted workspace/ })
    const again = await cli(['workspace', 'delete', env.MAILSINK_WORKSPACE_ID ?? ''], admin())
    expect(again).toMatchObject({ code: EXIT.failure, err: /^not_found:/ })
  })

  it('creates a workspace with --json, and rejects --ttl without --ephemeral', async () => {
    const created = await cli(['workspace', 'create', '--name', 'Acme CI', '--json'], admin())
    const body = json<{ workspace: { id: string; name: string }; workspaceKey: string }>(
      created.out,
    )
    expect(body.workspace.name).toBe('Acme CI')
    expect(body.workspaceKey).toMatch(/^mskw_/)
    await h.admin.admin.workspaces.delete(body.workspace.id)
    const bad = await cli(['workspace', 'create', '--ttl', '1h'], admin())
    expect(bad).toMatchObject({ code: EXIT.usage, err: /--ttl requires --ephemeral/ })
  })

  it('waits for a message already stored, with its links', async () => {
    await h.send({
      to: 'wait-cli@example.com',
      subject: 'Confirm your account',
      html: '<a href="https://app.example.com/verify?token=abc">Verify</a>',
    })
    const found = await cli(['wait', '--to', 'wait-cli@example.com', '--json'], sink())
    expect(found.code).toBe(EXIT.ok)
    const message = json<{ subject: string; extractedLinks: string[] }>(found.out)
    expect(message.subject).toBe('Confirm your account')
    expect(message.extractedLinks).toContain('https://app.example.com/verify?token=abc')

    const human = await cli(['wait', '--to', 'wait-cli@example.com'], sink())
    expect(human.out).toMatch(/Subject\s+Confirm your account/)
    const link = await cli(['wait', '--to', 'wait-cli@example.com', '--link', '/verify'], sink())
    expect(link.out).toBe('https://app.example.com/verify?token=abc')
    const noLink = await cli(['wait', '--to', 'wait-cli@example.com', '--link', '/nope'], sink())
    expect(noLink.code).toBe(EXIT.failure)
  })

  it('exits with code 3 when no message comes before the timeout', async () => {
    const none = await cli(['wait', '--to', 'nobody@example.com', '--timeout', '300ms'], sink())
    expect(none).toMatchObject({ code: EXIT.waitTimeout, err: /^wait_timeout:/ })
    // --since now skips the message stored by the previous test.
    const old = await cli(
      ['wait', '--to', 'wait-cli@example.com', '--since', 'now', '--timeout', '300ms'],
      sink(),
    )
    expect(old.code).toBe(EXIT.waitTimeout)
  })

  it('sets and resets an override', async () => {
    const set = await cli(
      ['override', 'set', '--hard-bounce', '20', '--latency', '100-500', '--ttl', '10m', '--json'],
      sink(),
    )
    expect(set.code).toBe(EXIT.ok)
    const state = json<{ workspace: { config: unknown; expiresAt: string | null } }>(set.out)
    expect(state.workspace.config).toEqual({
      rates: { hard_bounce: 20 },
      latency: { minMs: 100, maxMs: 500 },
    })
    expect(state.workspace.expiresAt).not.toBeNull()
    const human = await cli(['override', 'set', '--error-rate', '5'], sink())
    expect(human.out).toMatch(/^Override active on the workspace: .*"errorRate":5/)
    const reset = await cli(['override', 'reset'], sink())
    expect(reset.out).toBe('Override reset on the workspace.')
    expect((await h.sink.overrides.get()).workspace).toBeNull()
    const empty = await cli(['override', 'set'], sink())
    expect(empty.code).toBe(EXIT.usage)
  })

  it('purges the messages, with the Admin key and the workspace too', async () => {
    await h.send({ subject: 'To purge' })
    const env = { ...admin(), MAILSINK_WORKSPACE: h.workspaceId }
    const purged = await cli(['purge', '--json'], env)
    expect(purged.code).toBe(EXIT.ok)
    expect(json<{ count: number }>(purged.out).count).toBeGreaterThan(0)
    expect((await cli(['purge'], sink())).out).toBe('Purged 0 messages.')
  })

  it('reports missing credentials and refused keys', async () => {
    const url = { MAILSINK_URL: h.server.url }
    expect(await cli(['workspace', 'list'], url)).toMatchObject({
      code: EXIT.usage,
      err: /MAILSINK_ADMIN_KEY/,
    })
    expect(await cli(['purge'], url)).toMatchObject({ code: EXIT.usage, err: /MAILSINK_KEY/ })
    const refused = await cli(['purge'], { ...url, MAILSINK_KEY: 'mskw_unknown' })
    expect(refused.code).toBe(EXIT.failure)
    expect(refused.err).not.toContain('mskw_unknown')
    expect(await cli(['wait', '--nope'], url)).toMatchObject({ code: EXIT.usage })
    expect(await cli(['workspace', 'list'], { MAILSINK_URL: 'ftp://x' })).toMatchObject({
      code: EXIT.usage,
      err: /MAILSINK_URL/,
    })
  })
})
