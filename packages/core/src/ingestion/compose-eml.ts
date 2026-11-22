import type { Address } from '@mailsink/contracts'
import MailComposer from 'nodemailer/lib/mail-composer'
import { detectMimeType } from 'nodemailer/lib/mime-funcs/mime-types'
import type { NormalizedAttachment, NormalizedEmail } from './normalize'

/** Content type of an attachment: the declared one, else detected from the filename. */
export function attachmentContentType(attachment: NormalizedAttachment): string {
  return attachment.contentType ?? detectMimeType(attachment.filename ?? false)
}

const addresses = (list: Address[]) =>
  list.map((a) => (a.name ? { name: a.name, address: a.email } : a.email))

/** `Message-ID` of a composed message, derived from the Mailsink message id. */
export const messageIdHeader = (messageId: string) => `<${messageId}@mailsink>`

/**
 * Raw MIME source of an API-ingested message (D9), as the provider would have sent it: Bcc
 * is left out of the headers (it stays in the recipients). Caller headers are kept; files
 * and URLs are never read (attachments only carry bytes).
 */
export async function composeEml(
  email: NormalizedEmail,
  options: { messageId: string; date: Date },
): Promise<Uint8Array> {
  const composer = new MailComposer({
    from: addresses([email.from])[0],
    to: addresses(email.to),
    cc: addresses(email.cc),
    bcc: addresses(email.bcc),
    replyTo: addresses(email.replyTo),
    subject: email.subject,
    messageId: messageIdHeader(options.messageId),
    date: options.date,
    ...(email.text !== null ? { text: email.text } : {}),
    ...(email.html !== null ? { html: email.html } : {}),
    headers: email.headers,
    attachments: email.attachments.map((a) => ({
      content: Buffer.from(a.content),
      contentType: attachmentContentType(a),
      ...(a.filename ? { filename: a.filename } : {}),
      ...(a.contentId ? { cid: a.contentId } : {}),
    })),
    disableFileAccess: true,
    disableUrlAccess: true,
  })
  const raw = await composer.compile().build()
  return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
}
