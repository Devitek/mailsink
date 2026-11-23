import { describeDb } from '@mailsink/db/testing'
import { expect, it } from 'vitest'
import { createMailsink, isMailsinkError } from '../src'
import { useHarness } from './harness'

describeDb('SDK admin', (ctx) => {
  const h = useHarness(ctx)

  it('manages a persistent workspace: list, get, update, rotate the key, delete', async () => {
    const { workspaces } = h.admin.admin
    const created = await workspaces.create({ name: 'Staging', slug: 'staging-sdk' })
    expect(created.workspace).toMatchObject({ slug: 'staging-sdk', ephemeral: false })

    const persistent = await workspaces.list()
    expect(persistent.data.map((w) => w.slug)).toContain('staging-sdk')
    expect(persistent.data.map((w) => w.id)).not.toContain(h.workspaceId)
    const all = await workspaces.list({ includeEphemeral: true, limit: 200 })
    expect(all.data.map((w) => w.id)).toContain(h.workspaceId)

    const updated = await workspaces.update('staging-sdk', { name: 'Staging 2', maxMessages: 100 })
    expect(updated).toMatchObject({ name: 'Staging 2', maxMessages: 100 })
    expect((await workspaces.get(created.workspace.id)).name).toBe('Staging 2')

    const rotated = await workspaces.rotateKey('staging-sdk')
    const oldKey = h.admin.with({ key: created.workspaceKey, adminKey: undefined })
    const error = await oldKey.messages.list().catch((e: unknown) => e)
    expect(isMailsinkError(error, 'unauthorized')).toBe(true)
    const fresh = h.admin.with({ key: rotated.workspaceKey, adminKey: undefined })
    expect((await fresh.messages.list()).data).toEqual([])

    await workspaces.delete('staging-sdk')
    const gone = await workspaces.get('staging-sdk').catch((e: unknown) => e)
    expect(isMailsinkError(gone, 'not_found')).toBe(true)
  })

  it('adds, renames, disables, rotates and deletes a connection', async () => {
    const { connections, workspaces } = h.admin.admin
    const created = await connections.create(h.workspaceId, { kind: 'brevo', name: 'Brevo' })
    expect(created.credentials).toMatchObject({ kind: 'brevo' })
    const renamed = await connections.update(h.workspaceId, created.id, {
      name: 'Brevo 2',
      enabled: false,
    })
    expect(renamed.name).toBe('Brevo 2')
    expect(renamed.disabledAt).not.toBeNull()
    const rotated = await connections.rotate(h.workspaceId, created.id)
    expect(rotated.credentials).not.toEqual(created.credentials)
    await connections.delete(h.workspaceId, created.id)
    const detail = await workspaces.get(h.workspaceId)
    expect(detail.connections.map((c) => c.id)).toEqual([h.connectionId])
  })

  it('manages Brevo templates', async () => {
    const { templates } = h.admin.admin
    const created = await templates.create(h.workspaceId, {
      name: 'Welcome',
      subject: 'Hi {{ params.name }}',
      html: '<p>Hi {{ params.name }}</p>',
    })
    expect((await templates.get(h.workspaceId, created.externalId)).name).toBe('Welcome')
    const patched = await templates.update(h.workspaceId, created.externalId, { name: 'Welcome 2' })
    expect(patched.name).toBe('Welcome 2')
    expect((await templates.list(h.workspaceId)).data).toHaveLength(1)
    await templates.delete(h.workspaceId, created.externalId)
    expect((await templates.list(h.workspaceId)).data).toEqual([])
  })

  it('reads the admin API log and works with the admin key plus a workspace', async () => {
    const page = await h.admin.admin.logs.list()
    expect(Array.isArray(page.data)).toBe(true)
    const viaAdmin = createMailsink({
      url: h.server.url,
      adminKey: h.admin.options.adminKey,
      workspace: h.workspaceId,
    })
    expect(Array.isArray((await viaAdmin.messages.list()).data)).toBe(true)
    const seen = h.server.seen.at(-1)
    expect(seen?.headers.get('x-mailsink-workspace')).toBe(h.workspaceId)
  })
})
