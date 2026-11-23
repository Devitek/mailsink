import { describe, expect, it } from 'vitest'
import { timeoutMessage, toQuery } from '../src/expect-email'
import { getCode, getLink, rebaseUrl } from '../src/links'
import { resolveWorkspaceOptions } from '../src/options'
import { connectionsEnv, parseEnvSnippet, pickConnection } from '../src/workspace'

describe('resolveWorkspaceOptions', () => {
  it('reads the environment and applies the defaults', () => {
    const resolved = resolveWorkspaceOptions(
      {},
      { workerIndex: 2, env: { MAILSINK_URL: 'http://mail.test', MAILSINK_ADMIN_KEY: 'k' } },
    )
    expect(resolved).toEqual({
      url: 'http://mail.test',
      adminKey: 'k',
      validate: false,
      input: {
        name: 'playwright-w2',
        ephemeral: true,
        idleTtlSeconds: 600,
        metadata: { createdBy: 'playwright · worker 2' },
        connections: [{ kind: 'resend', name: 'app' }],
      },
    })
  })

  it('lets options win and passes other workspace fields through', () => {
    const resolved = resolveWorkspaceOptions(
      {
        url: 'http://a.test',
        adminKey: 'x',
        name: 'checkout',
        idleTtlSeconds: 120,
        connections: [{ kind: 'smtp', name: 'mailer' }],
        metadata: { team: 'acme' },
        workspace: { maxMessages: 50 },
      },
      { workerIndex: 0, env: { MAILSINK_URL: 'http://ignored.test' } },
    )
    expect(resolved.url).toBe('http://a.test')
    expect(resolved.input).toMatchObject({
      name: 'checkout',
      idleTtlSeconds: 120,
      maxMessages: 50,
      metadata: { createdBy: 'playwright · worker 0', team: 'acme' },
      connections: [{ kind: 'smtp', name: 'mailer' }],
    })
  })

  it('explains a missing URL or admin key', () => {
    expect(() => resolveWorkspaceOptions({}, { workerIndex: 0, env: {} })).toThrow(/MAILSINK_URL/)
    expect(() => resolveWorkspaceOptions({ url: 'http://a.test' }, { workerIndex: 0 })).toThrow(
      /MAILSINK_ADMIN_KEY/,
    )
  })
})

describe('connection helpers', () => {
  const connections = [
    {
      name: 'app',
      kind: 'resend',
      envSnippet: 'RESEND_API_KEY=msk_a\nRESEND_BASE_URL=http://m.test\n',
    },
    { name: 'other', kind: 'resend', envSnippet: 'RESEND_API_KEY=msk_b\n' },
    { name: 'mailer', kind: 'smtp', envSnippet: 'SMTP_HOST=m.test\nSMTP_PORT=2525\n' },
  ]

  it('parses .env snippets, the first connection winning', () => {
    expect(parseEnvSnippet('# c\nA=1\n\nB = x=y \n')).toEqual({ A: '1', B: 'x=y' })
    expect(connectionsEnv(connections)).toEqual({
      RESEND_API_KEY: 'msk_a',
      RESEND_BASE_URL: 'http://m.test',
      SMTP_HOST: 'm.test',
      SMTP_PORT: '2525',
    })
  })

  it('picks a connection by name, then kind', () => {
    const all = connections as never as Parameters<typeof pickConnection>[0]
    expect(pickConnection(all).name).toBe('app')
    expect(pickConnection(all, 'other').name).toBe('other')
    expect(pickConnection(all, 'smtp').name).toBe('mailer')
    expect(() => pickConnection(all, 'brevo')).toThrow(/app \(resend\), other/)
  })
})

describe('links and codes', () => {
  const email = {
    id: 'msg_1',
    subject: 'Sign in',
    text: 'Code: 482913. Or open https://app.example.com/auth/magic?token=t1',
    html: null,
    links: [],
  }

  it('gets a link or a code, and explains a miss', () => {
    expect(getLink(email)).toBe('https://app.example.com/auth/magic?token=t1')
    expect(getLink(email, /magic/)).toBe('https://app.example.com/auth/magic?token=t1')
    expect(() => getLink(email, '/reset')).toThrow(
      'No link matching /reset in the email "Sign in" (msg_1). Links: https://app.example.com',
    )
    expect(() => getLink({ subject: 'Hi', text: 'none' })).toThrow('The email has no link.')
    expect(getCode(email)).toBe('482913')
    expect(() => getCode(email, { length: 4 })).toThrow('No code of 4 digits in the email')
  })

  it('rebases a link on another origin and base path', () => {
    expect(rebaseUrl('https://app.example.com/a/b?x=1#h', 'http://127.0.0.1:3000/')).toBe(
      'http://127.0.0.1:3000/a/b?x=1#h',
    )
    expect(rebaseUrl('https://app.example.com/a', 'http://ci.test/app')).toBe(
      'http://ci.test/app/a',
    )
  })
})

describe('expectEmail helpers', () => {
  it('accepts a single status', () => {
    expect(toQuery({ to: 'a@example.com', status: 'delivered' })).toEqual({
      to: 'a@example.com',
      status: ['delivered'],
    })
  })

  it('lists what arrived when nothing matched', () => {
    const since = new Date('2026-01-01T00:00:00Z')
    const recent = [
      {
        id: 'msg_1',
        to: [{ email: 'bob@example.com', name: null }],
        subject: 'Welcome',
        status: 'delivered',
      },
    ] as never
    expect(timeoutMessage({ to: 'jane@example.com' }, { since, timeout: 500 }, recent)).toBe(
      'expectEmail: no email matched {"to":"jane@example.com"} within 500 ms ' +
        '(since 2026-01-01T00:00:00.000Z).\n' +
        'Emails received since then (newest first, at most 10):\n' +
        '  - to bob@example.com: "Welcome" [delivered] msg_1',
    )
    expect(timeoutMessage({}, { since }, [])).toContain('No email was received since then.')
  })
})
