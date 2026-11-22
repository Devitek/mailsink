import type { SendEmailRequest } from '@mailsink/contracts'
import type { NormalizedEmail } from '../ingestion/normalize'

/** Native API request (already validated by SendEmailRequest) to NormalizedEmail. */
export function fromNativeRequest(request: SendEmailRequest): NormalizedEmail {
  return {
    from: request.from,
    to: request.to,
    cc: request.cc ?? [],
    bcc: request.bcc ?? [],
    replyTo: request.replyTo ?? [],
    subject: request.subject,
    html: request.html ?? null,
    text: request.text ?? null,
    headers: request.headers ?? {},
    tags: request.tags ?? [],
    metadata: request.metadata ?? null,
    attachments: (request.attachments ?? []).map((a) => ({
      filename: a.filename,
      content: new Uint8Array(Buffer.from(a.content, 'base64')),
      ...(a.contentType ? { contentType: a.contentType } : {}),
      ...(a.contentId ? { contentId: a.contentId } : {}),
    })),
  }
}
