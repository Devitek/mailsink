import { findWorkspaceByRef, newId, workspaces } from '@mailsink/db'
import { createTestMessage, createTestWorkspace, describeDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { installTestRuntime } from '../http/test-fixtures'
import { stopRuntime } from '../runtime/boot'
import type { Runtime } from '../runtime/container'
import {
  LAST_WORKSPACE_COOKIE,
  lastWorkspaceHome,
  openWorkspace,
  PICKER_PAGE_SIZE,
  readWorkspacePage,
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

  it('reads persistent and ephemeral workspaces apart', async () => {
    const qa = await createTestWorkspace(ctx.db, { slug: 'qa-staging' })
    const ci = await createTestWorkspace(ctx.db, {
      slug: 'ci-run-1',
      ephemeral: true,
      idleTtlSeconds: 600,
      expiresAt: new Date('2026-11-23T10:00:00Z'),
    })

    const persistent = await readWorkspacePage(runtime, { ephemeral: false })
    expect(persistent.data.map((w) => w.slug)).toContain(qa.slug)
    expect(persistent.data.some((w) => w.ephemeral)).toBe(false)
    expect(persistent.ephemeralCount).toBeGreaterThanOrEqual(1)

    const ephemeral = await readWorkspacePage(runtime, { ephemeral: true })
    expect(ephemeral.data).toContainEqual({
      id: ci.id,
      slug: ci.slug,
      name: ci.name,
      ephemeral: true,
      expiresAt: '2026-11-23T10:00:00.000Z',
    })
    expect(ephemeral.data.every((w) => w.ephemeral)).toBe(true)
  })

  it('counts the messages of each persistent workspace (prototype picker rows)', async () => {
    const busy = await createTestWorkspace(ctx.db, { slug: 'busy-staging' })
    const idle = await createTestWorkspace(ctx.db, { slug: 'idle-staging' })
    await createTestMessage(ctx.db, busy.id)
    await createTestMessage(ctx.db, busy.id)
    const { data } = await readWorkspacePage(runtime, { ephemeral: false })
    expect(data.find((w) => w.id === busy.id)?.messageCount).toBe(2)
    expect(data.find((w) => w.id === idle.id)?.messageCount).toBe(0)
  })

  it('searches the slug and the name, wildcards taken literally', async () => {
    await createTestWorkspace(ctx.db, { slug: 'billing-sandbox', name: 'Billing' })
    await createTestWorkspace(ctx.db, { slug: 'payroll-qa', name: 'Payroll 100% Service' })
    const slugs = async (q: string) =>
      (await readWorkspacePage(runtime, { ephemeral: false, q })).data.map((w) => w.slug)
    expect(await slugs('BILLING')).toEqual(['billing-sandbox'])
    expect(await slugs('100%')).toEqual(['payroll-qa'])
    expect(await slugs('_')).toEqual([])
  })

  it('keeps persistent workspaces visible behind more than 500 ephemeral ones (#104)', async () => {
    const before = (await readWorkspacePage(runtime, { ephemeral: true })).ephemeralCount
    const kept = await createTestWorkspace(ctx.db, { slug: 'kept-staging' })
    const rows = Array.from({ length: 520 }, (_, i) => ({
      id: newId('ws'),
      slug: `ci-flood-${i}`,
      name: `CI ${i}`,
      createdVia: 'admin_api' as const,
      ephemeral: true,
      idleTtlSeconds: 3600,
      expiresAt: new Date(Date.now() + 3_600_000),
    }))
    await ctx.db.insert(workspaces).values(rows)

    const first = await readWorkspacePage(runtime, { ephemeral: false })
    expect(first.data.map((w) => w.slug)).toContain(kept.slug)
    expect(first.ephemeralCount).toBe(before + 520)

    const seen = new Set<string>()
    let cursor: string | undefined
    let pages = 0
    do {
      const page = await readWorkspacePage(runtime, { ephemeral: true, q: 'ci-flood', cursor })
      expect(page.data.length).toBeLessThanOrEqual(PICKER_PAGE_SIZE)
      for (const w of page.data) seen.add(w.slug)
      cursor = page.nextCursor ?? undefined
      pages++
    } while (cursor)
    expect(seen.size).toBe(520)
    expect(pages).toBe(Math.ceil(520 / PICKER_PAGE_SIZE))
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
