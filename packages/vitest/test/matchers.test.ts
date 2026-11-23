// The matchers on plain values: messages as the SDK answers them, and a fake client.
import { MailsinkError, type MessageSummary } from '@devitek/mailsink'
import { describe, expect, it, vi } from 'vitest'
import '../src/setup'

const message = {
  subject: 'Confirm your account',
  status: 'delivered' as const,
  html: '<a href="https://app.example.com/verify?token=abc&amp;x=1">Confirm</a>',
  text: 'Or open https://app.example.com/help.',
  links: [],
  recipients: [
    { email: 'ada@example.test', status: 'delivered' as const },
    { email: 'grace@example.test', status: 'hard_bounce' as const },
  ],
}

const summary = (subject: string): MessageSummary =>
  ({
    id: 'msg_1',
    subject,
    status: 'queued',
    to: [{ email: 'ada@example.test', name: null }],
  }) as unknown as MessageSummary

function fakeClient(options: { waitFor?: () => Promise<unknown>; list?: MessageSummary[] }) {
  return {
    messages: {
      waitFor: vi.fn(options.waitFor ?? (async () => summary('Welcome'))),
      list: vi.fn(async () => ({ data: options.list ?? [], nextCursor: null })),
    },
  }
}

const timeout = () =>
  Promise.reject(new MailsinkError({ code: 'wait_timeout', message: 'no', status: 408 }))

describe('toHaveStatus', () => {
  it('checks the aggregate status, one of several, or a recipient', () => {
    expect(message).toHaveStatus('delivered')
    expect(message).toHaveStatus(['queued', 'delivered'])
    expect(message).not.toHaveStatus('failed')
    expect(message).toHaveStatus('hard_bounce', { recipient: 'Grace@example.test' })
  })

  it('explains a mismatch and an unknown recipient', () => {
    expect(() => expect(message).toHaveStatus('failed')).toThrow(
      'expected message "Confirm your account" to have status failed, got delivered',
    )
    expect(() =>
      expect(message).toHaveStatus('delivered', { recipient: 'x@example.test' }),
    ).toThrow('expected recipient x@example.test of message "Confirm your account" to exist')
    expect(() => expect(null).toHaveStatus('delivered')).toThrow('expects a message')
  })
})

describe('toHaveLink', () => {
  it('matches a substring, a RegExp, a predicate, or any link', () => {
    expect(message).toHaveLink('/verify?token=abc&x=1')
    expect(message).toHaveLink(/\/help$/)
    expect(message).toHaveLink((url) => url.searchParams.get('token') === 'abc')
    expect(message).toHaveLink()
    expect(message).not.toHaveLink('/unsubscribe')
    expect({ subject: 'Plain', text: 'No link here' }).not.toHaveLink()
  })

  it('lists the links of the message when none matches', () => {
    expect(() => expect(message).toHaveLink('/reset')).toThrow(
      /to have a link matching \/reset\nLinks:\n {2}- https:\/\/app\.example\.com\/verify/,
    )
    expect(() => expect(message).not.toHaveLink('/help')).toThrow('not to have a link')
  })
})

describe('toHaveReceivedEmail', () => {
  it('waits with every message of the workspace counting by default', async () => {
    const client = fakeClient({})
    await expect(client).toHaveReceivedEmail({ to: 'ada@example.test' }, { timeout: 1_000 })
    expect(client.messages.waitFor).toHaveBeenCalledWith(
      { to: 'ada@example.test' },
      { since: new Date(0), timeout: 1_000 },
    )
    await expect({ client }).toHaveReceivedEmail()
  })

  it('fails with the latest messages after the timeout', async () => {
    const client = fakeClient({ waitFor: timeout, list: [summary('Invoice')] })
    await expect(expect(client).toHaveReceivedEmail({ subject: 'Welcome' })).rejects.toThrow(
      /matching \{"subject":"Welcome"\} within 5000 ms\nLatest messages of the workspace:\n {2}- "Invoice" to ada@example.test \(queued\)/,
    )
    const empty = fakeClient({ waitFor: timeout })
    await expect(expect(empty).toHaveReceivedEmail()).rejects.toThrow(
      'The workspace has no message.',
    )
  })

  it('checks once without waiting under .not', async () => {
    const none = fakeClient({})
    await expect(none).not.toHaveReceivedEmail({ to: 'grace@example.test' })
    expect(none.messages.waitFor).not.toHaveBeenCalled()
    expect(none.messages.list).toHaveBeenCalledWith({
      to: 'grace@example.test',
      since: new Date(0),
      limit: 1,
    })
    const some = fakeClient({ list: [summary('Welcome')] })
    await expect(expect(some).not.toHaveReceivedEmail()).rejects.toThrow(
      'expected no email matching any filter, found:\n  - "Welcome"',
    )
  })

  it('rethrows other errors and rejects what is not a client', async () => {
    const broken = fakeClient({
      waitFor: () => Promise.reject(new MailsinkError({ code: 'unauthorized', message: 'nope' })),
    })
    await expect(expect(broken).toHaveReceivedEmail()).rejects.toThrow('nope')
    await expect(expect({}).toHaveReceivedEmail()).rejects.toThrow('expects a Mailsink client')
  })
})
