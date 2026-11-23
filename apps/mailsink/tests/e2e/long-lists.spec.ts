import type { APIRequestContext } from '@playwright/test'
import { createWorkspace, deleteWorkspace } from './recipe/fixtures'
import { expect, signIn, test } from './ui/fixtures'
import { BASE_URL } from './web-server'

// Long lists (#118): the templates section past its first page of 200, the suppression
// list past the 200 rows the DataTable renders at once (virtualised beyond), and the logs
// table laid out for a phone by the server render itself (CSS breakpoints, no JavaScript).

const ADDRESSES = 210

/** Every suppressed address, in list order (newest first), through the Capture API. */
async function suppressedAddresses(capture: APIRequestContext): Promise<string[]> {
  const all: string[] = []
  let cursor: string | null = null
  do {
    const query: string = cursor ? `&cursor=${cursor}` : ''
    const page = await (await capture.get(`/capture/suppressions?limit=200${query}`)).json()
    all.push(...page.data.map((s: { email: string }) => s.email))
    cursor = page.nextCursor
  } while (cursor)
  return all
}

test('the templates section loads the templates past its first page', async ({ page, admin }) => {
  const templates = Array.from({ length: 205 }, (_, i) => ({
    externalId: i + 1,
    name: `Template ${i + 1}`,
    subject: `Subject ${i + 1}`,
    text: 'Hello',
  }))
  const res = await admin.post('/admin/workspaces', {
    data: { name: `templates ${Date.now()}`, templates },
  })
  expect(res.status(), await res.text()).toBe(201)
  const { workspace } = await res.json()
  try {
    await signIn(page)
    await page.goto(`/w/${workspace.slug}/settings?section=templates`)
    await expect(page.getByRole('status').filter({ hasText: 'SSE Live' })).toBeVisible()
    const rows = page.getByTestId('template-row')
    await expect(rows).toHaveCount(200)
    await page.getByRole('button', { name: 'Load more' }).click()
    await expect(rows).toHaveCount(205)
    await expect(page.getByRole('button', { name: 'Load more' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Edit template 205' })).toBeVisible()
  } finally {
    await deleteWorkspace(admin, workspace.id)
  }
})

test('the suppression list renders only the rows in view past 200', async ({
  page,
  playwright,
  admin,
}) => {
  test.slow()
  const ws = await createWorkspace(playwright, admin, `long ${Date.now()}`)
  const ingest = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { authorization: `Bearer ${ws.connectionKey}` },
  })
  try {
    const slug = (await (await admin.get(`/admin/workspaces/${ws.id}`)).json()).slug
    const rule = await ws.capture.post('/capture/override', {
      data: { config: { rules: [{ match: '*@bounce.test', status: 'hard_bounce' }] } },
    })
    expect(rule.ok(), await rule.text()).toBe(true)
    const emails = Array.from({ length: ADDRESSES }, (_, i) => ({
      from: 'app@example.test',
      to: `user${String(i).padStart(3, '0')}@bounce.test`,
      subject: `Bounce ${i}`,
      text: 'hello',
    }))
    for (let i = 0; i < ADDRESSES; i += 100) {
      const sent = await ingest.post('/v1/emails/batch', { data: emails.slice(i, i + 100) })
      expect(sent.ok(), await sent.text()).toBe(true)
    }
    await expect
      .poll(async () => (await suppressedAddresses(ws.capture)).length, { timeout: 60_000 })
      .toBe(ADDRESSES)
    const ordered = await suppressedAddresses(ws.capture)

    await signIn(page)
    await page.goto(`/w/${slug}/suppressions`)
    // Hydrated (the stream only connects in the browser) before « Load more » is clicked.
    await expect(page.getByRole('status').filter({ hasText: 'SSE Live' })).toBeVisible()
    await expect(page.getByTestId('suppression-total')).toHaveText(`${ADDRESSES} addresses`)
    const rows = page.getByRole('row').filter({ hasText: '@bounce.test' })
    const more = page.getByRole('button', { name: 'Load more' })
    for (const loaded of [50, 100, 150, 200]) {
      await expect(rows).toHaveCount(loaded)
      await more.click()
    }
    await expect(more).toBeHidden()
    // 210 rows loaded, only the ones in view (plus the overscan) in the page, at the top
    // as at the end of the list.
    const scroller = page.locator('div.overflow-y-auto', {
      has: page.getByRole('heading', { name: 'Suppression list' }),
    })
    await scroller.evaluate((el) => el.scrollTo({ top: 0 }))
    await expect(rows.first()).toContainText(ordered[0] ?? '')
    expect(await rows.count()).toBeLessThan(100)
    await expect(rows.filter({ hasText: ordered.at(-1) ?? '' })).toHaveCount(0)
    await scroller.evaluate((el) => el.scrollTo({ top: el.scrollHeight }))
    await expect(rows.filter({ hasText: ordered.at(-1) ?? '' })).toHaveCount(1)
    await expect(rows.filter({ hasText: ordered[0] ?? '' })).toHaveCount(0)
    expect(await rows.count()).toBeLessThan(100)
  } finally {
    await ingest.dispose()
    await ws.dispose()
  }
})

test.describe('on a phone without JavaScript', () => {
  test.use({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false })

  test('the server renders the narrow logs table', async ({ page, workspace }) => {
    const ws = await workspace()
    await signIn(page)
    await page.goto(`/w/${ws.slug}/logs`)
    const table = page.getByRole('table', { name: 'API calls' })
    await expect(table.getByRole('columnheader', { name: 'Timestamp' })).toBeVisible()
    await expect(table.getByRole('columnheader', { name: 'Action' })).toBeVisible()
    for (const hidden of ['Type', 'Connection', 'Duration']) {
      await expect(table.getByRole('columnheader', { name: hidden })).toBeHidden()
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
