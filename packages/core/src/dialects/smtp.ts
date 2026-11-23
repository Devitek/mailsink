import type { Address } from '@mailsink/contracts'
import { type AddressObject, type Attachment, type HeaderLines, simpleParser } from 'mailparser'
import { DomainError } from '../errors'
import type { NormalizedAttachment, NormalizedEmail } from '../ingestion/normalize'

/** The SMTP envelope of a transaction: `MAIL FROM` (null for `<>`) and every `RCPT TO`. */
export interface SmtpEnvelope {
  mailFrom: string | null
  rcptTo: string[]
}

/** Headers carried by the message structure itself, not kept in `headers`. */
const STRUCTURAL_HEADERS = new Set([
  'from',
  'to',
  'cc',
  'bcc',
  'reply-to',
  'subject',
  'mime-version',
  'content-type',
  'content-transfer-encoding',
])

function addressesOf(field: AddressObject | AddressObject[] | undefined): Address[] {
  const objects = field === undefined ? [] : Array.isArray(field) ? field : [field]
  const out: Address[] = []
  const walk = (list: AddressObject['value']) => {
    for (const a of list) {
      if (a.group) walk(a.group)
      if (!a.address) continue
      const email = a.address.toLowerCase()
      out.push(a.name ? { email, name: a.name } : { email })
    }
  }
  for (const o of objects) walk(o.value)
  return out
}

/** Unfolded header values by lower-cased name, repeated names joined with `, `. */
function headersOf(lines: HeaderLines): Record<string, string> {
  const out: Record<string, string> = {}
  for (const { key, line } of lines) {
    if (STRUCTURAL_HEADERS.has(key)) continue
    const colon = line.indexOf(':')
    const value = line
      .slice(colon + 1)
      .replace(/\r?\n[ \t]+/g, ' ')
      .trim()
    out[key] = out[key] === undefined ? value : `${out[key]}, ${value}`
  }
  return out
}

function attachmentOf(a: Attachment): NormalizedAttachment {
  const inline = a.related || a.contentDisposition === 'inline'
  const contentId = a.cid ?? a.contentId?.replace(/^<|>$/g, '')
  return {
    filename: a.filename ?? null,
    contentType: a.contentType,
    ...(inline && contentId ? { contentId } : {}),
    content: new Uint8Array(a.content.buffer, a.content.byteOffset, a.content.byteLength),
  }
}

/**
 * SMTP `DATA` to NormalizedEmail (03-contracts « SMTP mapping »): parsed with mailparser,
 * the raw EML kept byte for byte (D9). Recipients are the envelope ones: an address listed
 * in `To` or `Cc` keeps that kind, any other envelope recipient is `bcc`, and a header
 * address that was never given in `RCPT TO` is not a recipient. The sender is the `From`
 * header, else `MAIL FROM`. Throws `validation_error` when neither is present.
 */
export async function fromSmtpMessage(
  raw: Uint8Array,
  envelope: SmtpEnvelope,
): Promise<NormalizedEmail> {
  const parsed = await simpleParser(Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength), {
    keepCidLinks: true,
    skipHtmlToText: true,
    skipTextToHtml: true,
    skipTextLinks: true,
  })
  const envelopeTo = [...new Set(envelope.rcptTo.map((a) => a.toLowerCase()))]
  const sent = new Set(envelopeTo)
  const listed = new Set<string>()
  const keep = (list: Address[]) =>
    list.filter((a) => sent.has(a.email) && !listed.has(a.email) && listed.add(a.email))
  const to = keep(addressesOf(parsed.to))
  const cc = keep(addressesOf(parsed.cc))
  const bcc = envelopeTo.filter((email) => !listed.has(email)).map((email) => ({ email }))

  const from =
    addressesOf(parsed.from)[0] ??
    (envelope.mailFrom ? { email: envelope.mailFrom.toLowerCase() } : undefined)
  if (!from) throw new DomainError('validation_error', 'Message has no sender address')

  return {
    from,
    to,
    cc,
    bcc,
    replyTo: addressesOf(parsed.replyTo),
    subject: parsed.subject ?? '',
    html: typeof parsed.html === 'string' ? parsed.html : null,
    text: parsed.text ?? null,
    headers: headersOf(parsed.headerLines),
    tags: [],
    metadata: null,
    attachments: parsed.attachments.map(attachmentOf),
    raw,
  }
}
