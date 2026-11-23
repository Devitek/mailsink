import { describe, expect, it } from 'vitest'
import {
  boundBody,
  logBody,
  messageIdsOf,
  redactHeaders,
  redactSecrets,
  stripAttachments,
} from './sanitize'
import { capTranscript, redactTranscript } from './transcript'

const msg = (n: number) => `msg_0192f3a4-7b1c-7d2e-8f00-00000000000${n}`

describe('redactHeaders', () => {
  it('keeps the scheme and the key prefix, never the secret', () => {
    const headers = new Headers({
      authorization: 'Bearer msk_supersecretvalue0123',
      'api-key': 'mskw_othersecret',
      cookie: 'session=abc',
      'content-type': 'application/json',
    })
    expect(redactHeaders(headers)).toEqual({
      authorization: 'Bearer msk_[redacted]',
      'api-key': 'mskw_[redacted]',
      cookie: '[redacted]',
      'content-type': 'application/json',
    })
    expect(redactHeaders(new Headers({ authorization: 'Basic dXNlcjpwYXNz' }))).toEqual({
      authorization: 'Basic [redacted]',
    })
  })
})

describe('stripAttachments', () => {
  it('replaces attachment contents at any depth (batches, Brevo `attachment`)', () => {
    const body = [
      { subject: 'a', attachments: [{ filename: 'a.pdf', content: 'QUJD' }] },
      { attachment: [{ name: 'b.txt', content: 'AAAAAAAA' }, 'odd'] },
    ]
    expect(stripAttachments(body)).toEqual([
      { subject: 'a', attachments: [{ filename: 'a.pdf', content: '[omitted: 4 chars]' }] },
      { attachment: [{ name: 'b.txt', content: '[omitted: 8 chars]' }, 'odd'] },
    ])
  })
})

describe('redactSecrets', () => {
  it('redacts secret-looking keys and Mailsink keys inside strings', () => {
    const body = {
      workspaceKey: 'mskw_abcdefghijklmnop',
      connections: [{ credentials: { apiKey: 'msk_abcdefghijkl', smtpPassword: 'hunter2' } }],
      snippet: 'RESEND_API_KEY=msk_abcdefghijklmnop\nHOST=x',
      subject: 'msk_ is a prefix',
    }
    expect(redactSecrets(body)).toEqual({
      workspaceKey: 'mskw_[redacted]',
      connections: [{ credentials: { apiKey: 'msk_[redacted]', smtpPassword: '[redacted]' } }],
      snippet: 'RESEND_API_KEY=msk_[redacted]\nHOST=x',
      subject: 'msk_ is a prefix',
    })
  })
})

describe('logBody and boundBody', () => {
  it('parses JSON, keeps raw text otherwise, null when empty', () => {
    expect(logBody('{"a":1}')).toEqual({ a: 1 })
    expect(logBody('not json')).toBe('not json')
    expect(logBody('')).toBeNull()
    expect(logBody(null)).toBeNull()
  })

  it('keeps a preview of a body over the cap', () => {
    expect(boundBody({ text: 'x'.repeat(50) }, 20)).toEqual({
      truncated: true,
      size: 61,
      preview: '{"text":"xxxxxxxxxxx',
    })
    expect(logBody('y'.repeat(30), 10)).toEqual({
      truncated: true,
      size: 30,
      preview: 'y'.repeat(10),
    })
  })
})

describe('messageIdsOf', () => {
  it('finds ids of native, batch and Brevo responses', () => {
    expect(messageIdsOf({ id: msg(1) })).toEqual([msg(1)])
    expect(messageIdsOf({ data: [{ id: msg(1) }, { id: msg(2) }] })).toEqual([msg(1), msg(2)])
    expect(messageIdsOf({ messageId: `<${msg(3)}@mailsink>` })).toEqual([msg(3)])
    expect(messageIdsOf({ messageIds: [msg(4)] })).toEqual([msg(4)])
    expect(messageIdsOf({ error: { code: 'rate_limited' } })).toEqual([])
    expect(messageIdsOf({ id: 'evt_1' })).toEqual([])
  })
})

describe('transcripts', () => {
  const line = (dir: 'C' | 'S', text: string, at = 0) => ({ at, dir, line: text })

  it('redacts AUTH PLAIN and the answers to 334 challenges', () => {
    const lines = [
      line('C', 'EHLO client'),
      line('C', 'AUTH PLAIN AGpvaG4Ac2VjcmV0'),
      line('S', '235 2.7.0 Authentication successful'),
      line('C', 'AUTH LOGIN'),
      line('S', '334 VXNlcm5hbWU6'),
      line('C', 'am9obg=='),
      line('S', '334 UGFzc3dvcmQ6'),
      line('C', 'c2VjcmV0'),
      line('C', 'MAIL FROM:<a@x.io>'),
    ]
    expect(redactTranscript(lines).map((l) => l.line)).toEqual([
      'EHLO client',
      'AUTH PLAIN [redacted]',
      '235 2.7.0 Authentication successful',
      'AUTH LOGIN',
      '334 VXNlcm5hbWU6',
      '[redacted]',
      '334 UGFzc3dvcmQ6',
      '[redacted]',
      'MAIL FROM:<a@x.io>',
    ])
  })

  it('caps the line count around an omission marker and each line length', () => {
    const lines = Array.from({ length: 20 }, (_, i) => line('C', `NOOP ${i}`, i))
    const capped = capTranscript(lines, 5)
    expect(capped.map((l) => l.line)).toEqual([
      'NOOP 0',
      'NOOP 1',
      '[… 16 lines omitted]',
      'NOOP 18',
      'NOOP 19',
    ])
    const long = capTranscript([line('S', 'z'.repeat(1_200))])[0]?.line
    expect(long?.endsWith('[… 200 chars omitted]')).toBe(true)
  })
})
