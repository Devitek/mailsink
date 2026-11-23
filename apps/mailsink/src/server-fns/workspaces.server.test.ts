import { findWorkspaceByRef } from '@mailsink/db'
import { createTestWorkspace, describeDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { installTestRuntime } from '../http/test-fixtures'
import { stopRuntime } from '../runtime/boot'
import type { Runtime } from '../runtime/container'
import {
  LAST_WORKSPACE_COOKIE,
  lastWorkspaceHome,
  openWorkspace,
  readWorkspaceList,
} from './workspaces.server'

// The request cookie jar of TanStack Start, replaced by a plain map.
const jar = vi.hoisted(() => new Map<string, string>())
vi.mock('@tanstack/react-start/server', () => ({
  getCookie: (name: string) => jar.get(name),
  setCookie: (name: string, value: string) => jar.set(name, value),
}))

describeDb('UI workspace server functions', (ctx) => {
  let runtime: Runtime
  beforeAll(async () => {
    runtime = await installTestRuntime(ctx.handle)
  })
  afterAll(() => stopRuntime())
  beforeEach(() => jar.clear())

  it('lists persistent workspaces and only counts ephemeral ones unless asked', async () => {
    const qa = await createTestWorkspace(ctx.db, { slug: 'qa-staging' })
    const ci = await createTestWorkspace(ctx.db, {
      slug: 'ci-run-1',
      ephemeral: true,
      idleTtlSeconds: 600,
      expiresAt: new Date('2026-11-23T10:00:00Z'),
    })

    const hidden = await readWorkspaceList(runtime, { ephemeral: false })
    expect(hidden.persistent.map((w) => w.slug)).toContain(qa.slug)
    expect(hidden.ephemeral).toEqual([])
    expect(hidden.ephemeralCount).toBeGreaterThanOrEqual(1)

    const shown = await readWorkspaceList(runtime, { ephemeral: true })
    expect(shown.ephemeral).toContainEqual({
      id: ci.id,
      slug: ci.slug,
      name: ci.name,
      ephemeral: true,
      expiresAt: '2026-11-23T10:00:00.000Z',
    })
    expect(shown.persistent.some((w) => w.ephemeral)).toBe(false)
  })

  it('opening a workspace touches it and remembers it as the next home', async () => {
    const ws = await createTestWorkspace(ctx.db, {
      lastActivityAt: new Date(Date.now() - 60_000),
    })
    expect(await lastWorkspaceHome(runtime)).toBe('/')

    const opened = await openWorkspace(runtime, ws.slug)
    expect(opened?.id).toBe(ws.id)
    expect(jar.get(LAST_WORKSPACE_COOKIE)).toBe(ws.slug)
    expect(await lastWorkspaceHome(runtime)).toBe(`/w/${ws.slug}`)

    const row = await findWorkspaceByRef(ctx.db, ws.id)
    expect(row?.lastActivityAt.getTime()).toBeGreaterThan(ws.lastActivityAt.getTime())
  })

  it('opens by slug only, and forgets a home that no longer exists', async () => {
    const ws = await createTestWorkspace(ctx.db)
    expect(await openWorkspace(runtime, ws.id)).toBeNull()
    expect(await openWorkspace(runtime, 'no-such-workspace')).toBeNull()
    jar.set(LAST_WORKSPACE_COOKIE, 'deleted-workspace')
    expect(await lastWorkspaceHome(runtime)).toBe('/')
  })
})
