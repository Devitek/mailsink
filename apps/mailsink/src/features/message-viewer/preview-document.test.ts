import { describe, expect, it } from 'vitest'
import { dataUrl, PREVIEW_CSP, previewDocument } from './preview-document'

const HEAD = '<meta name="color-scheme" content="dark"><base target="_blank">'

describe('preview document', () => {
  it('injects the scheme and the link target right after the head opening', () => {
    const doc = previewDocument('<!doctype html><html><head lang="en"><title>x</title></head>', {
      scheme: 'dark',
    })
    expect(doc).toBe(`<!doctype html><html><head lang="en">${HEAD}<title>x</title></head>`)
  })

  it('falls back on the html opening, the doctype, then the start', () => {
    expect(previewDocument('<HTML><body>x</body></HTML>', { scheme: 'dark' })).toBe(
      `<HTML>${HEAD}<body>x</body></HTML>`,
    )
    expect(previewDocument('<!DOCTYPE html><p>x</p>', { scheme: 'dark' })).toBe(
      `<!DOCTYPE html>${HEAD}<p>x</p>`,
    )
    expect(previewDocument('<p>x</p>', { scheme: 'light' })).toBe(
      '<meta name="color-scheme" content="light"><base target="_blank"><p>x</p>',
    )
  })

  it('replaces known cid: references only', () => {
    const doc = previewDocument('<img src="cid:Logo@x"><img src=\'cid:other\'>', {
      scheme: 'light',
      inline: { '<logo@x>': 'data:image/png;base64,AA==' },
    })
    expect(doc).toContain('<img src="data:image/png;base64,AA==">')
    expect(doc).toContain("<img src='cid:other'>")
  })

  it('keeps the download sandbox and forbids scripts', () => {
    expect(PREVIEW_CSP.startsWith("sandbox; default-src 'none'")).toBe(true)
    expect(PREVIEW_CSP).not.toMatch(/script-src|allow-/)
    expect(dataUrl('image/png', new Uint8Array([0, 1]))).toBe('data:image/png;base64,AAE=')
  })
})
