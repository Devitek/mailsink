import type { DemoCopy, DemoText } from './copy'

// HTML and text bodies of a demo message: a small transactional layout (logo, paragraphs,
// one button, footer) as real senders build them, with inline styles only.

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface Bodies {
  html: string
  text: string
}

export function renderBodies(
  copy: DemoCopy,
  text: DemoText,
  link: string,
  options: { logoCid?: string } = {},
): Bodies {
  const logo = options.logoCid
    ? `<img src="cid:${options.logoCid}" width="32" height="32" alt="Fieldnote">`
    : '<strong style="font-size:18px">Fieldnote</strong>'
  const paragraphs = text.paragraphs
    .map((p) => `<p style="margin:0 0 14px;line-height:1.55">${escapeHtml(p)}</p>`)
    .join('')
  const button = text.action
    ? `<p style="margin:22px 0"><a href="${link}" style="display:inline-block;padding:10px 18px;border-radius:6px;background:#1f2328;color:#ffffff;text-decoration:none">${escapeHtml(text.action)}</a></p>`
    : ''
  const html = [
    '<!doctype html><html><body style="margin:0;background:#f4f4f2;font-family:Helvetica,Arial,sans-serif;color:#1f2328">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">',
    '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px">',
    `<tr><td style="padding:28px 32px 8px">${logo}</td></tr>`,
    `<tr><td style="padding:8px 32px 24px"><h1 style="margin:0 0 18px;font-size:20px">${escapeHtml(text.subject)}</h1>${paragraphs}${button}`,
    `<p style="margin:0;color:#57606a">${escapeHtml(copy.team)}</p></td></tr>`,
    '</table>',
    `<p style="margin:18px 0 0;font-size:12px;color:#8c959f">${escapeHtml(copy.footer)} <a href="https://fieldnote.example/unsubscribe" style="color:#8c959f">Unsubscribe</a></p>`,
    '</td></tr></table></body></html>',
  ].join('')
  const plain = [
    text.subject,
    '',
    ...text.paragraphs,
    ...(text.action ? ['', `${text.action}: ${link}`] : []),
    '',
    copy.team,
    '',
    copy.footer,
  ].join('\n')
  return { html, text: plain }
}
