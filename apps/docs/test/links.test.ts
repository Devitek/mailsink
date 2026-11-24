import { describe, expect, it } from 'vitest'
import { rewriteLinks } from '../scripts/links'

const options = {
  source: 'docs/guides/e2e.md',
  slugs: new Map([
    ['docs/guides/sdk.md', 'guides/sdk'],
    ['docs/guides/e2e.md', 'guides/e2e'],
    ['CONTRIBUTING.md', 'contributing'],
    ['README.md', ''],
  ]),
  isDirectory: (path: string) => path === 'packages/sdk',
  repoUrl: 'https://github.com/Acme/repo',
}

describe('rewriteLinks', () => {
  it('points a link to another rendered page at its site path, hash kept', () => {
    expect(rewriteLinks('See [SDK](sdk.md) and [tests](../../CONTRIBUTING.md#e2e).', options)).toBe(
      'See [SDK](/guides/sdk/) and [tests](/contributing/#e2e).',
    )
  })

  it('maps the root page to the site root', () => {
    expect(rewriteLinks('[home](../../README.md)', options)).toBe('[home](/)')
  })

  it('sends files and directories that are not rendered to GitHub', () => {
    expect(rewriteLinks('[a](../../packages/sdk) [b](../../LICENSE#L1)', options)).toBe(
      '[a](https://github.com/Acme/repo/tree/main/packages/sdk) ' +
        '[b](https://github.com/Acme/repo/blob/main/LICENSE#L1)',
    )
  })

  it('serves images that are not rendered from the raw file', () => {
    expect(rewriteLinks('![logo](../../.github/logo.svg "Logo")', options)).toBe(
      '![logo](https://raw.githubusercontent.com/Acme/repo/main/.github/logo.svg "Logo")',
    )
  })

  it('leaves absolute URLs, same-page hashes and mail links alone', () => {
    const text = '[x](https://example.com/a.md) [y](#setup) [z](mailto:jane@example.com)'
    expect(rewriteLinks(text, options)).toBe(text)
  })

  it('does not touch code spans nor fenced code blocks', () => {
    const text = ['Use `[a](sdk.md)` here.', '```md', '[b](sdk.md)', '```', '[c](sdk.md)'].join(
      '\n',
    )
    expect(rewriteLinks(text, options)).toBe(
      ['Use `[a](sdk.md)` here.', '```md', '[b](sdk.md)', '```', '[c](/guides/sdk/)'].join('\n'),
    )
  })

  it('rewrites a link whose text is a code span', () => {
    expect(rewriteLinks('| [`@acme/sdk`](sdk.md) | [`x`](../../packages/sdk) |', options)).toBe(
      '| [`@acme/sdk`](/guides/sdk/) | [`x`](https://github.com/Acme/repo/tree/main/packages/sdk) |',
    )
  })

  it('fails on a link to a repository path that does not exist', () => {
    const strict = { ...options, exists: (path: string) => path !== 'docs/guides/gone.md' }
    expect(() => rewriteLinks('[gone](gone.md)', strict)).toThrow(
      'docs/guides/e2e.md: broken link to docs/guides/gone.md',
    )
  })

  it('rewrites reference definitions', () => {
    expect(rewriteLinks('[sdk]: sdk.md#install', options)).toBe('[sdk]: /guides/sdk/#install')
  })
})
