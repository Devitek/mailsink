import { describe, expect, it } from 'vitest'
import { htmlToText, PREVIEW_LENGTH, previewText } from './preview'

describe('inbox previews', () => {
  it('keeps the visible text of HTML only', () => {
    const html = `<html><head><title>T</title><style>p{color:red}</style></head>
      <body><!-- hidden --><p>Hello&nbsp;<b>Jane</b> &amp; co &#8212; &#x2713;</p>
      <script>alert(1)</script></body></html>`
    expect(previewText({ text: html, html: true })).toBe('Hello Jane & co — ✓')
  })

  it('collapses whitespace of text bodies and cuts long ones', () => {
    expect(previewText({ text: 'Line one\n\n  line   two', html: false })).toBe('Line one line two')
    const long = previewText({ text: 'word '.repeat(100), html: false })
    expect(long.length).toBeLessThanOrEqual(PREVIEW_LENGTH)
    expect(long.endsWith('…')).toBe(true)
  })

  it('survives truncated markup and unknown entities', () => {
    expect(htmlToText('<p>Cut <a href="x')).toBe(' Cut  ')
    expect(previewText({ text: '<style>a{}', html: true })).toBe('')
    expect(previewText({ text: '&bogus; &#0; ok', html: true })).toBe('&bogus; &#0; ok')
    expect(previewText({ text: null, html: false })).toBe('')
  })
})
