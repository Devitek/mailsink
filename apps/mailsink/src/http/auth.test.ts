import { describeDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { stopRuntime } from '../runtime/boot'
import type { AuthMode } from './auth'
import { defineApi } from './handler'
import { ADMIN_KEY, installTestRuntime, request, seedWorkspace } from './test-fixtures'

type Seed = Awaited<ReturnType<typeof seedWorkspace>>

/** A route per auth mode answering who called, through a real Request. */
const whoami = (auth: AuthMode) =>
  defineApi({
    auth,
    handler: ({ auth: principal }) =>
      principal && principal.kind === 'workspace'
        ? {
            via: principal.via,
            workspace: principal.workspace.id,
            connection: principal.connection?.id ?? null,
          }
        : { principal },
  })
const routes = {
  none: whoami('none'),
  admin: whoami('admin'),
  workspace: whoami('workspace'),
  connection: whoami('connection'),
}

async function call(mode: AuthMode, init: Parameters<typeof request>[1] = {}) {
  const response = await routes[mode]({ request: request('/probe', init) })
  return { status: response.status, body: await response.json(), headers: response.headers }
}

describeDb('defineApi authentication', (ctx) => {
  let seed: Seed
  let disabled: Seed
  beforeAll(async () => {
    await installTestRuntime(ctx.handle)
    seed = await seedWorkspace(ctx.db)
    disabled = await seedWorkspace(ctx.db, { disabled: true })
  })
  afterAll(() => stopRuntime())

  it('lets a public route through without credentials', async () => {
    expect(await call('none')).toMatchObject({ status: 200, body: { principal: null } })
  })

  it('answers 401 with the contract body when the credential is missing or unknown', async () => {
    for (const bearer of [undefined, 'msk_unknown-key-0123456789', 'garbage']) {
      const res = await call('workspace', { bearer })
      expect(res.status).toBe(401)
      expect(res.body).toEqual({
        error: {
          code: 'unauthorized',
          message: 'Missing or invalid API key',
          details: { credential: bearer === undefined ? 'missing' : 'invalid' },
        },
        requestId: res.headers.get('x-request-id'),
      })
      expect(res.headers.get('www-authenticate')).toBe('Bearer')
    }
  })

  it('accepts the admin key on admin routes only', async () => {
    expect(await call('admin', { bearer: ADMIN_KEY })).toMatchObject({
      status: 200,
      body: { principal: { kind: 'admin' } },
    })
    expect((await call('admin', { bearer: seed.connectionKey })).status).toBe(401)
    expect((await call('connection', { bearer: ADMIN_KEY })).body.error.code).toBe('forbidden')
  })

  it('scopes the admin key to X-Mailsink-Workspace (id or slug, D12)', async () => {
    const bySlug = await call('workspace', {
      bearer: ADMIN_KEY,
      headers: { 'x-mailsink-workspace': seed.workspace.slug },
    })
    expect(bySlug).toMatchObject({
      status: 200,
      body: { via: 'admin_key', workspace: seed.workspace.id },
    })
    const missing = await call('workspace', { bearer: ADMIN_KEY })
    expect(missing).toMatchObject({ status: 400, body: { error: { code: 'validation_error' } } })
    const unknown = await call('workspace', {
      bearer: ADMIN_KEY,
      headers: { 'x-mailsink-workspace': 'nope' },
    })
    expect(unknown).toMatchObject({ status: 404, body: { error: { code: 'not_found' } } })
  })

  it('resolves msk_ and mskw_ keys by hash to their workspace (D11, D12)', async () => {
    expect(await call('workspace', { bearer: seed.connectionKey })).toMatchObject({
      status: 200,
      body: { via: 'connection_key', workspace: seed.workspace.id, connection: seed.connection.id },
    })
    expect(await call('workspace', { bearer: seed.workspaceKey })).toMatchObject({
      status: 200,
      body: { via: 'workspace_key', workspace: seed.workspace.id, connection: null },
    })
  })

  it('reads the Brevo api-key header', async () => {
    const res = await call('connection', { headers: { 'api-key': seed.connectionKey } })
    expect(res).toMatchObject({ status: 200, body: { via: 'connection_key' } })
  })

  it('refuses revoked keys, workspace keys on ingestion and disabled connections', async () => {
    expect((await call('workspace', { bearer: seed.revokedKey })).status).toBe(401)
    expect(await call('connection', { bearer: seed.workspaceKey })).toMatchObject({
      status: 403,
      body: { error: { code: 'forbidden' } },
    })
    expect((await call('connection', { bearer: disabled.connectionKey })).status).toBe(403)
  })

  it('refuses a key used on another workspace', async () => {
    const res = await call('workspace', {
      bearer: seed.workspaceKey,
      headers: { 'x-mailsink-workspace': disabled.workspace.id },
    })
    expect(res).toMatchObject({ status: 403, body: { error: { code: 'forbidden' } } })
  })
})
