import { describe, expect, it } from 'vitest'
import { DEFAULT_DATABASE_URL, parseDatabaseUrl } from '../src/url'

describe('parseDatabaseUrl', () => {
  it('defaults to a PGlite directory under ./data', () => {
    expect(DEFAULT_DATABASE_URL).toBe('pglite://./data')
    expect(parseDatabaseUrl(DEFAULT_DATABASE_URL)).toEqual({ driver: 'pglite', dataDir: './data' })
  })

  it('maps pglite://memory to an in-memory database', () => {
    expect(parseDatabaseUrl('pglite://memory')).toEqual({ driver: 'pglite', dataDir: undefined })
  })

  it('accepts absolute PGlite directories', () => {
    expect(parseDatabaseUrl('pglite:///var/lib/mailsink')).toEqual({
      driver: 'pglite',
      dataDir: '/var/lib/mailsink',
    })
  })

  it.each(['postgres://u:p@localhost:5432/db', 'postgresql://u:p@db/mailsink?sslmode=require'])(
    'keeps %s as a Postgres connection string',
    (url) => {
      expect(parseDatabaseUrl(url)).toEqual({ driver: 'postgres', connectionString: url })
    },
  )

  it.each(['mysql://x', 'pglite://', 'nonsense'])('rejects %s', (url) => {
    expect(() => parseDatabaseUrl(url)).toThrow(/DATABASE_URL/)
  })
})
