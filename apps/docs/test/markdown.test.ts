import { describe, expect, it } from 'vitest'
import { firstFence, pickSections, splitTitle, toFrontmatter } from '../scripts/markdown'

describe('splitTitle', () => {
  it('takes the first level one heading as the title and drops it from the body', () => {
    expect(splitTitle('# TypeScript SDK (`@acme/sdk`)\n\nIntro.\n')).toEqual({
      title: 'TypeScript SDK (@acme/sdk)',
      body: 'Intro.\n',
    })
  })

  it('fails on a page without a title, so a new source cannot render untitled', () => {
    expect(() => splitTitle('Intro only.\n')).toThrow(/title/)
  })
})

describe('pickSections', () => {
  const readme = [
    '<p>banner</p>',
    '',
    'Intro.',
    '## Installation',
    'Run it.',
    '```sh',
    '## not a heading',
    '```',
    '### Detail',
    'More.',
    '## License',
    'MIT.',
  ].join('\n')

  it('keeps the named level two sections, nested headings included', () => {
    expect(pickSections(readme, ['Installation'])).toBe(
      [
        '## Installation',
        'Run it.',
        '```sh',
        '## not a heading',
        '```',
        '### Detail',
        'More.',
      ].join('\n'),
    )
  })

  it('returns the text before the first section for the empty name', () => {
    expect(pickSections(readme, [''])).toBe('<p>banner</p>\n\nIntro.')
  })

  it('fails when a section is missing, so a renamed heading breaks the build', () => {
    expect(() => pickSections(readme, ['Usage'])).toThrow(/Usage/)
  })
})

describe('firstFence', () => {
  it('returns the first fenced code block with its fences', () => {
    expect(firstFence('Text.\n\n```sh\nrun\n```\n\n```ts\nx\n```')).toBe('```sh\nrun\n```')
  })
})

describe('toFrontmatter', () => {
  it('writes JSON scalars, which YAML reads as is', () => {
    expect(toFrontmatter({ title: 'A: "b"', sidebar: { order: 2 } })).toBe(
      '---\ntitle: "A: \\"b\\""\nsidebar: {"order":2}\n---\n',
    )
  })
})
