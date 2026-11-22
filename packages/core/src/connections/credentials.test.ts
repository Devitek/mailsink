import { ConnectionKey, WorkspaceKey } from '@mailsink/contracts'
import { describe, expect, it } from 'vitest'
import {
  generateKey,
  generateSmtpPassword,
  generateSmtpUsername,
  hashSmtpPassword,
  verifySmtpPassword,
} from './credentials'

describe('generateKey', () => {
  it('builds contract-valid msk_ and mskw_ keys with a short display prefix', () => {
    const connection = generateKey('connection')
    const workspace = generateKey('workspace')
    expect(ConnectionKey.safeParse(connection.key).success).toBe(true)
    expect(WorkspaceKey.safeParse(workspace.key).success).toBe(true)
    expect(connection.key.startsWith(connection.displayPrefix)).toBe(true)
    expect(connection.displayPrefix).toMatch(/^msk_[A-Za-z0-9_-]{8}$/)
    expect(workspace.displayPrefix).toMatch(/^mskw_[A-Za-z0-9_-]{8}$/)
    expect(connection.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(generateKey('connection').key).not.toBe(connection.key)
  })
})

describe('SMTP credentials', () => {
  it('hashes passwords with scrypt and verifies them', async () => {
    const password = generateSmtpPassword()
    expect(password.length).toBeGreaterThanOrEqual(32)
    const hash = await hashSmtpPassword(password)
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$/)
    expect(hash).not.toContain(password)
    expect(await verifySmtpPassword(password, hash)).toBe(true)
    expect(await verifySmtpPassword(`${password}x`, hash)).toBe(false)
    expect(await hashSmtpPassword(password)).not.toBe(hash) // salted
  })

  it('rejects a malformed stored hash instead of throwing', async () => {
    expect(await verifySmtpPassword('x', 'bcrypt$whatever')).toBe(false)
  })

  it('derives a valid, unique username from the workspace slug', () => {
    const name = generateSmtpUsername('a'.repeat(63))
    expect(name).toMatch(/^[a-zA-Z0-9._-]{3,64}$/)
    expect(generateSmtpUsername('team')).toMatch(/^team-[0-9a-f]{8}$/)
  })
})
