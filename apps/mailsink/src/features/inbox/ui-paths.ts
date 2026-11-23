// Same-origin routes of the inbox, authenticated by the UI session cookie (the Capture API
// wants a Bearer key, which a browser EventSource, download link or iframe cannot send).

const ws = (slug: string) => `/w/${encodeURIComponent(slug)}/m`

export type PreviewScheme = 'light' | 'dark'

export const inboxPaths = {
  /** Server-Sent Events of the workspace (`GET /capture/stream` behind the session). */
  stream: (slug: string, lastEventId?: string | null) =>
    `${ws(slug)}/stream${lastEventId ? `?lastEventId=${encodeURIComponent(lastEventId)}` : ''}`,
  /** Raw EML download. */
  raw: (slug: string, messageId: string) => `${ws(slug)}/${messageId}/raw`,
  attachment: (slug: string, messageId: string, attachmentId: string) =>
    `${ws(slug)}/${messageId}/attachments/${attachmentId}`,
  /** HTML body for the sandboxed preview iframe. */
  html: (slug: string, messageId: string, scheme: PreviewScheme) =>
    `${ws(slug)}/${messageId}/html?scheme=${scheme}`,
}
