import { randomUUID } from 'node:crypto'
import { type APIRequestContext, test as base, expect, type Page } from '@playwright/test'
import { issueSessionToken } from '../../../src/auth/session-token'
import { adminContext } from '../recipe/fixtures'
import { ADMIN_KEY, BASE_URL, SESSION_SECRET } from '../web-server'

// Fixtures of the web UI scenarios: workspaces created through the Admin API (deleted after
// the test) and a signed-in browser through POST /login, as the sign-in screen does.

export type UiWorkspace = { id: string; slug: string; name: string }

type Fixtures = {
  admin: APIRequestContext
  /** Creates a workspace for this test; every one is deleted afterwards. */
  workspace: (options?: { ephemeral?: boolean }) => Promise<UiWorkspace>
}

export const test = base.extend<Fixtures>({
  admin: async ({ playwright }, use) => {
    const admin = await adminContext(playwright)
    await use(admin)
    await admin.dispose()
  },
  workspace: async ({ admin }, use) => {
    const created: string[] = []
    await use(async ({ ephemeral = false } = {}) => {
      const name = `ui ${ephemeral ? 'ci' : 'qa'} ${randomUUID().slice(0, 8)}`
      const res = await admin.post('/admin/workspaces', {
        data: ephemeral ? { name, ephemeral, idleTtlSeconds: 600 } : { name },
      })
      expect(res.status(), await res.text()).toBe(201)
      const { workspace } = await res.json()
      created.push(workspace.id)
      return { id: workspace.id, slug: workspace.slug, name: workspace.name }
    })
    for (const id of created) await admin.delete(`/admin/workspaces/${id}`)
  },
})

/** Signs the browser in the way the sign-in form does (the cookie lands in the context). */
export async function signIn(page: Page): Promise<void> {
  const res = await page.request.post('/login', { data: { key: ADMIN_KEY } })
  expect(res.status()).toBe(204)
}

/** A session cookie signed by the server's secret, already past its lifetime. */
export async function plantExpiredSession(page: Page): Promise<void> {
  const token = issueSessionToken(SESSION_SECRET, { ttlSeconds: 60, now: Date.now() - 3_600_000 })
  await page.context().addCookies([{ name: 'mailsink_session', value: token, url: BASE_URL }])
}

export async function lastActivityAt(admin: APIRequestContext, id: string): Promise<number> {
  const res = await admin.get(`/admin/workspaces/${id}`)
  return Date.parse((await res.json()).lastActivityAt)
}

export { ADMIN_KEY, expect }
