import { describe, expect, it } from 'vitest'
import { extractLinks } from './links'

describe('extractLinks', () => {
  it('reads anchors from html with their text, decoding entities', () => {
    const html = `<p>Hello <a class="btn" href="https://app.io/confirm?a=1&amp;b=2">Confirm <b>now</b></a>
      <A HREF='http://x.io/help'>help</A> <a href="mailto:x@y.io">mail</a> <a name="top">t</a></p>`
    expect(extractLinks(html, null)).toEqual([
      { url: 'https://app.io/confirm?a=1&b=2', text: 'Confirm now' },
      { url: 'http://x.io/help', text: 'help' },
    ])
  })

  it('reads bare urls from text and deduplicates against html', () => {
    const text =
      'Confirm: https://app.io/confirm?a=1&b=2. Docs (https://docs.io/x) and https://new.io'
    expect(extractLinks('<a href="https://app.io/confirm?a=1&amp;b=2">Go</a>', text)).toEqual([
      { url: 'https://app.io/confirm?a=1&b=2', text: 'Go' },
      { url: 'https://docs.io/x' },
      { url: 'https://new.io' },
    ])
  })

  it('returns an empty list without content', () => {
    expect(extractLinks(null, null)).toEqual([])
  })
})
