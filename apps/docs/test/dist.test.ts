import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  checkDist,
  countMermaidBlocks,
  hasRawMermaid,
  internalTargets,
  resolveTarget,
} from '../scripts/checks/dist'

function site(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'docs-dist-'))
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  return dir
}

const figure = '<figure class="ms-mermaid"><div></div></figure>'

describe('raw mermaid detection', () => {
  it('spots a block highlighted as code by Expressive Code or Shiki', () => {
    expect(hasRawMermaid('<pre data-language="mermaid"><code>graph</code></pre>')).toBe(true)
    expect(hasRawMermaid('<pre><code class="language-mermaid">graph</code></pre>')).toBe(true)
    expect(hasRawMermaid(`${figure}<pre data-language="ts"></pre>`)).toBe(false)
  })

  it('counts the mermaid fences of a source, tildes and longer fences included', () => {
    expect(countMermaidBlocks('```mermaid\na\n```\n\n~~~~mermaid\nb\n~~~~\n```ts\n```')).toBe(2)
  })
})

describe('internal links', () => {
  it('lists root-relative href and src targets without hash, query or protocol-relative URLs', () => {
    const html =
      '<a href="/guides/sdk/#install">a</a><a href="/api/?x=1">b</a><img src="/_astro/a.svg">' +
      '<a href="//cdn.example.com/x">c</a><a href="https://example.com/">d</a><a href="#top">e</a>'
    expect(internalTargets(html)).toEqual(['/guides/sdk/', '/api/', '/_astro/a.svg'])
  })

  it('resolves a page to its index.html and a file to itself', () => {
    const files = new Set(['index.html', 'api/index.html', 'favicon.svg'])
    const exists = (path: string) => files.has(path)
    expect(resolveTarget('/', exists)).toBe('index.html')
    expect(resolveTarget('/api/', exists)).toBe('api/index.html')
    expect(resolveTarget('/api', exists)).toBe('api/index.html')
    expect(resolveTarget('/favicon.svg', exists)).toBe('favicon.svg')
    expect(resolveTarget('/api/operations/missing/', exists)).toBeUndefined()
  })
})

describe('checkDist', () => {
  it('passes a sound site', () => {
    const dir = site({
      'index.html': '<a href="/architecture/sequence/">s</a><a href="/pagefind/x.js">p</a>',
      'architecture/sequence/index.html': `${figure}${figure}<a href="/api/">api</a>`,
      'api/index.html': '<a href="/">home</a>',
    })
    expect(checkDist({ dir, diagrams: new Map([['architecture/sequence', 2]]) })).toEqual([])
  })

  it('reports raw blocks, missing diagrams and broken links, the API reference included', () => {
    const dir = site({
      'index.html': '<a href="/api/operations/gone/">x</a>',
      'architecture/sequence/index.html': `${figure}<pre data-language="mermaid"></pre>`,
    })
    expect(checkDist({ dir, diagrams: new Map([['architecture/sequence', 2]]) })).toEqual([
      'architecture/sequence/index.html: mermaid block left as code',
      'index.html: broken link to /api/operations/gone/',
      'architecture/sequence/index.html: 1 rendered diagrams, 2 in the source',
    ])
  })
})
