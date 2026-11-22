import { CreateWorkspaceRequest, WorkspaceDetail } from '@mailsink/contracts'
import { apiKeys, connections } from '@mailsink/db'
import { describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { expect, it } from 'vitest'
import { createWorkspace, type ProvisionOptions } from './provision'
import { getWorkspaceDetail, listWorkspaceViews, removeWorkspace } from './queries'

const URL = 'https://mail.test'
const options: ProvisionOptions = {
  endpoints: { publicUrl: URL, smtpHost: 'mail.test', smtpPort: 2525 },
  defaultIdleTtlSeconds: 3600,
}
describeDb('workspace queries', (ctx) => {
  let clock = Date.parse('2026-11-22T10:00:00Z')
  // Distinct creation times: ids (UUIDv7) only sort by creation across milliseconds.
  const create = (input: Record<string, unknown>) => {
    clock += 1000
    return createWorkspace(ctx.db, CreateWorkspaceRequest.parse(input), {
      ...options,
      now: new Date(clock),
    })
  }

  it('lists persistent workspaces newest first, ephemeral ones on demand, by pages', async () => {
    const a = await create({ name: 'A' })
    const e = await create({ name: 'E', ephemeral: true })
    const b = await create({ name: 'B' })
    const persistent = await listWorkspaceViews(ctx.db, { includeEphemeral: false, limit: 50 }, URL)
    expect(persistent.data.map((w) => w.id)).toEqual([b.workspace.id, a.workspace.id])
    expect(persistent.nextCursor).toBeNull()

    const first = await listWorkspaceViews(ctx.db, { includeEphemeral: true, limit: 2 }, URL)
    expect(first.data.map((w) => w.id)).toEqual([b.workspace.id, e.workspace.id])
    expect(first.nextCursor).toBe(e.workspace.id)
    const second = await listWorkspaceViews(
      ctx.db,
      { includeEphemeral: true, limit: 2, cursor: first.nextCursor ?? undefined },
      URL,
    )
    expect(second).toEqual({ data: [a.workspace], nextCursor: null })
  })

  it('returns the detail by id or slug with connection key previews', async () => {
    const created = await create({
      name: 'Detail',
      connections: [
        { kind: 'resend', name: 'R' },
        { kind: 'smtp', name: 'S' },
      ],
    })
    const byId = await getWorkspaceDetail(ctx.db, created.workspace.id, URL)
    expect(WorkspaceDetail.parse(byId)).toEqual(byId)
    expect(await getWorkspaceDetail(ctx.db, created.workspace.slug, URL)).toEqual(byId)
    const previews = Object.fromEntries(byId.connections.map((c) => [c.name, c.keyPreview]))
    expect(previews).toEqual({ R: created.connections[0]?.keyPreview, S: null })
    expect(JSON.stringify(byId)).not.toContain('credentials')
  })

  it('deletes a workspace with its connections and keys', async () => {
    const created = await create({ name: 'Gone', connections: [{ kind: 'brevo', name: 'B' }] })
    await removeWorkspace(ctx.db, created.workspace.slug)
    await expect(getWorkspaceDetail(ctx.db, created.workspace.id, URL)).rejects.toMatchObject({
      code: 'not_found',
    })
    const id = created.workspace.id
    expect(await ctx.db.select().from(connections).where(eq(connections.workspaceId, id))).toEqual(
      [],
    )
    expect(await ctx.db.select().from(apiKeys).where(eq(apiKeys.workspaceId, id))).toEqual([])
    await expect(removeWorkspace(ctx.db, id)).rejects.toMatchObject({ code: 'not_found' })
  })
})
