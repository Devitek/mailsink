import { describe, expect, it } from 'vitest'
import { pruneSchemas } from './prune'

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })

describe('pruneSchemas', () => {
  it('drops unreferenced schemas and gives an output variant its plain name back', () => {
    const document = {
      paths: { '/a': { get: { schema: ref('ViewOutput') } } },
      components: {
        schemas: {
          View: { type: 'object' },
          ViewOutput: { type: 'object', properties: { b: ref('Inner') } },
          Inner: { type: 'string' },
          Orphan: { type: 'string' },
          Kept: { type: 'string' },
        },
      },
    }
    expect(pruneSchemas(document, ['Kept'])).toEqual({
      paths: { '/a': { get: { schema: ref('View') } } },
      components: {
        schemas: {
          View: { type: 'object', properties: { b: ref('Inner') } },
          Inner: { type: 'string' },
          Kept: { type: 'string' },
        },
      },
    })
  })

  it('keeps both variants when both are referenced', () => {
    const document = {
      paths: { '/a': { post: { in: ref('View'), out: ref('ViewOutput') } } },
      components: { schemas: { View: {}, ViewOutput: {} } },
    }
    expect(pruneSchemas(document, [])).toEqual(document)
  })
})
