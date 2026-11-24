import { describe, expect, it } from 'vitest'
import { insertDocs } from '../scripts/type-docs.ts'

const emitted = [
  'export declare const Page: {',
  '    data: {',
  '        id: string;',
  '        sender?: string | {',
  '            email: string;',
  '        } | {',
  '            name: string;',
  '        } | undefined;',
  '        headers: {',
  '            [x: string]: {',
  '                id: string;',
  '            };',
  '        };',
  '    }[];',
  '    "next-cursor": string | null;',
  '};',
  'export declare const Other: {',
  '    id: string;',
  '};',
].join('\n')

describe('insertDocs', () => {
  it('documents each property at its path, through arrays and union members', () => {
    const docs = new Map([
      ['Page.data.id', 'Message id.'],
      ['Page.data.sender.name', 'Display name.'],
      ['Page.next-cursor', 'Cursor of the next page.\nNull on the last one.'],
      ['Other.id', 'Other id, never */ closing.'],
    ])
    const lines = insertDocs(emitted, docs).split('\n')
    expect(lines[2]).toBe('        /** Message id. */')
    expect(lines[3]).toBe('        id: string;')
    expect(lines.indexOf('            /** Display name. */')).toBe(
      lines.indexOf('            name: string;') - 1,
    )
    expect(lines).toContain('    /**')
    expect(lines).toContain('     * Cursor of the next page.')
    expect(lines).toContain('     * Null on the last one.')
    expect(lines).toContain('    /** Other id, never *\\/ closing. */')
  })

  it('leaves the members of an index signature undocumented and keeps every line', () => {
    const docs = new Map([['Page.data.headers.id', 'Never placed.']])
    expect(insertDocs(emitted, docs)).toBe(emitted)
  })
})
