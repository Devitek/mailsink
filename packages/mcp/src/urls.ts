import type { MessageDetail } from '@mailsink/contracts'

/** `path` (leading slash) on the public URL of the instance. */
export const absolute = (publicUrl: string, path: string): string => `${publicUrl}${path}`

/**
 * The detail with absolute `rawUrl` and attachment `downloadUrl`: an agent reading a tool
 * answer has no base URL to resolve relative paths against. Both URLs answer to the same
 * workspace key as the MCP endpoint (Bearer).
 */
export function withAbsoluteUrls(detail: MessageDetail, publicUrl: string): MessageDetail {
  return {
    ...detail,
    rawUrl: absolute(publicUrl, detail.rawUrl),
    attachments: detail.attachments.map((a) => ({
      ...a,
      downloadUrl: absolute(publicUrl, a.downloadUrl),
    })),
  }
}
