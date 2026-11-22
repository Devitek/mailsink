import { sql } from 'drizzle-orm'
import type pg from 'pg'
import { describe, expect, it, vi } from 'vitest'
import { createDb } from '../src/client'
import { testDatabaseUrl } from '../src/testing'

// The pool connects lazily: nothing listens on this port and no query is ever sent.
const url = 'postgres://mailsink:mailsink@127.0.0.1:1/unreachable'

describe('createDb (postgres pool errors)', () => {
  it('handles an idle client error instead of letting it crash the process', async () => {
    const onConnectionError = vi.fn()
    const handle = createDb(url, { onConnectionError })
    const pool = handle.client as pg.Pool
    expect(pool.listenerCount('error')).toBe(1)

    const error = new Error('terminating connection due to administrator command')
    // Without a listener, EventEmitter throws on `error`.
    expect(() => pool.emit('error', error)).not.toThrow()
    expect(onConnectionError).toHaveBeenCalledWith(error)
    await handle.close()
  })

  it.runIf(testDatabaseUrl())(
    'survives a server-side kill of an idle connection, then reconnects',
    async () => {
      const onConnectionError = vi.fn()
      const handle = createDb(testDatabaseUrl(), { onConnectionError, maxConnections: 1 })
      const killer = createDb(testDatabaseUrl(), { maxConnections: 1 })
      try {
        const { rows } = await (handle.client as pg.Pool).query('select pg_backend_pid() as pid')
        await (killer.client as pg.Pool).query('select pg_terminate_backend($1)', [rows[0].pid])
        await vi.waitFor(() => expect(onConnectionError).toHaveBeenCalledTimes(1))
        await expect(handle.db.execute(sql`select 1`)).resolves.toBeDefined()
      } finally {
        await killer.close()
        await handle.close()
      }
    },
  )

  it('warns on the console by default', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const handle = createDb(url)
    ;(handle.client as pg.Pool).emit('error', new Error('connection lost'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('connection lost'))
    warn.mockRestore()
    await handle.close()
  })
})
