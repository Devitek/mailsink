import { CreateWorkspaceRequest } from '@mailsink/contracts'
import { findWorkspaceByRef } from '@mailsink/db'
import { createTestMessage, describeDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { installTestRuntime } from '../http/test-fixtures'
import { stopRuntime } from '../runtime/boot'
import type { Runtime } from '../runtime/container'
import {
  changeConnection,
  createConnection,
  deleteConnection,
  readConnectionsPage,
  rotateConnection,
} from './connections.server'
import {
  createWorkspaceFromUi,
  deleteWorkspaceFromUi,
  editWorkspace,
  rotateWorkspaceKeyFromUi,
} from './workspaces-manage.server'

describeDb('UI workspace and connection management', (ctx) => {
  let runtime: Runtime
  beforeAll(async () => {
    runtime = await installTestRuntime(ctx.handle, {
      publicUrl: 'https://mail.test',
      smtpPort: 2525,
    })
  })
  afterAll(() => stopRuntime())

  const create = (input: unknown) =>
    createWorkspaceFromUi(runtime, CreateWorkspaceRequest.parse(input))

  it('creates a persistent workspace from the UI, a taken slug is a field conflict', async () => {
    const created = await create({
      name: 'QA',
      slug: 'qa-ui',
      ephemeral: true,
      connections: [{ kind: 'smtp', name: 'smtp' }],
    })
    if (!created.ok) throw new Error('expected a workspace')
    expect(created.workspaceKey).toMatch(/^mskw_/)
    expect(created.connections[0]?.envSnippet).toContain('SMTP_PASS=')
    const row = await findWorkspaceByRef(ctx.db, 'qa-ui')
    expect(row).toMatchObject({ ephemeral: false, createdVia: 'ui', expiresAt: null })
    expect(await create({ name: 'Again', slug: 'qa-ui' })).toEqual({
      ok: false,
      conflict: 'slug',
    })
  })

  it('lists connections with their setup and a masked snippet, never a secret', async () => {
    await create({ name: 'List', slug: 'list-ui' })
    const added = await createConnection(runtime, 'list-ui', { kind: 'resend', name: 'Resend' })
    const smtp = await createConnection(runtime, 'list-ui', {
      kind: 'smtp',
      name: 'SMTP',
      smtpUsername: 'list-ui-smtp',
    })
    if (!added.ok || !smtp.ok) throw new Error('expected connections')
    const page = await readConnectionsPage(runtime, 'list-ui')
    expect(page?.workspace).toMatchObject({ slug: 'list-ui', retentionSeconds: 7 * 86_400 })
    const [resend, smtpRow] = page?.connections ?? []
    expect(resend?.setup).toEqual({ kind: 'resend', baseUrl: 'https://mail.test' })
    expect(resend?.maskedSnippet).toBe(
      `RESEND_API_KEY=${resend?.keyPreview}\nRESEND_BASE_URL=https://mail.test\n`,
    )
    expect(smtpRow?.setup).toEqual({
      kind: 'smtp',
      smtpHost: 'mail.test',
      smtpPort: 2525,
      smtpUser: 'list-ui-smtp',
    })
    expect(JSON.stringify(page)).not.toContain(
      added.connection.credentials.kind === 'resend' ? added.connection.credentials.apiKey : '!',
    )
    expect(
      await createConnection(runtime, 'list-ui', {
        kind: 'smtp',
        name: 'Dup',
        smtpUsername: 'list-ui-smtp',
      }),
    ).toEqual({ ok: false, conflict: 'smtp_username' })
    expect(await readConnectionsPage(runtime, page?.workspace.id ?? '')).toBeNull()
  })

  it('toggles, rotates and deletes a connection', async () => {
    await create({ name: 'Ops', slug: 'ops-ui', connections: [{ kind: 'brevo', name: 'B' }] })
    const page = await readConnectionsPage(runtime, 'ops-ui')
    const id = page?.connections[0]?.id ?? ''
    const off = await changeConnection(runtime, 'ops-ui', id, { enabled: false })
    expect(off.disabledAt).not.toBeNull()
    const rotated = await rotateConnection(runtime, 'ops-ui', id)
    expect(rotated.envSnippet).toMatch(/^BREVO_API_KEY=msk_/)
    await deleteConnection(runtime, 'ops-ui', id)
    expect((await readConnectionsPage(runtime, 'ops-ui'))?.connections).toEqual([])
  })

  it('edits then deletes a workspace by slug only', async () => {
    const created = await create({ name: 'Edit', slug: 'edit-ui' })
    if (!created.ok) throw new Error('expected a workspace')
    const edited = await editWorkspace(runtime, 'edit-ui', {
      name: 'Edited',
      retention: 3600,
      rateLimit: { limit: 5, windowSeconds: 1 },
    })
    expect(edited).toMatchObject({ name: 'Edited', retentionSeconds: 3600 })
    const row = await findWorkspaceByRef(ctx.db, 'edit-ui')
    await expect(deleteWorkspaceFromUi(runtime, row?.id ?? '')).rejects.toMatchObject({
      code: 'not_found',
    })
    await deleteWorkspaceFromUi(runtime, 'edit-ui')
    expect(await findWorkspaceByRef(ctx.db, 'edit-ui')).toBeUndefined()
  })

  it('counts the messages of each connection and rotates the workspace key', async () => {
    const created = await create({
      name: 'Counts',
      slug: 'counts-ui',
      connections: [
        { kind: 'resend', name: 'R' },
        { kind: 'brevo', name: 'B' },
      ],
    })
    if (!created.ok) throw new Error('expected a workspace')
    const [resend, brevo] = created.connections
    const ws = await findWorkspaceByRef(ctx.db, 'counts-ui')
    await createTestMessage(ctx.db, ws?.id ?? '', { connectionId: resend?.id })
    await createTestMessage(ctx.db, ws?.id ?? '', { connectionId: resend?.id })
    const page = await readConnectionsPage(runtime, 'counts-ui')
    const count = (id?: string) => page?.connections.find((c) => c.id === id)?.messageCount
    expect([count(resend?.id), count(brevo?.id)]).toEqual([2, 0])
    expect(page?.workspace.keyPreview).toBe(`${created.workspaceKey.slice(0, 13)}…`)

    const rotated = await rotateWorkspaceKeyFromUi(runtime, 'counts-ui')
    expect(rotated.workspaceKey).not.toBe(created.workspaceKey)
    const after = await readConnectionsPage(runtime, 'counts-ui')
    expect(after?.workspace.keyPreview).toBe(rotated.keyPreview)
  })
})
