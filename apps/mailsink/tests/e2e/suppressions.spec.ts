import { randomUUID } from 'node:crypto'
import { gotoHydrated } from './goto-hydrated'
import { expect, signIn, test } from './ui/fixtures'
import { BASE_URL } from './web-server'
import { createWorkspace } from './workspace-api'

// Suppression list (#42): fed by the simulation (a recipient rule forcing hard_bounce),
// read by pages of 50 with « Load more », filtered by address (kept in the URL), one
// address removed, then the whole list reset after a confirmation.

test('pages, filters, removes and resets the suppression list', async ({ page, playwright }) => {
  test.slow()
  const ws = await createWorkspace(`sup ${randomUUID().slice(0, 8)}`)
  await ws.sink.overrides.activate({ rules: [{ match: '*@bounce.test', status: 'hard_bounce' }] })
  const ingest = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { authorization: `Bearer ${ws.connectionKey}` },
  })
  const batch = Array.from({ length: 52 }, (_, i) => ({
    from: 'app@example.test',
    to: `user${String(i).padStart(2, '0')}@bounce.test`,
    subject: `Bounce ${i}`,
    text: 'hello',
  }))
  expect((await ingest.post('/v1/emails/batch', { data: batch })).ok()).toBe(true)
  await expect
    .poll(async () => (await ws.sink.suppressions.list({ limit: 100 })).data.length, {
      timeout: 30_000,
    })
    .toBe(52)

  await signIn(page)
  await gotoHydrated(page, `/w/${ws.slug}/suppressions`)
  await expect(page.getByRole('heading', { name: 'Suppression list' })).toBeVisible()
  const rows = page.getByRole('row').filter({ hasText: '@bounce.test' })
  await expect(rows).toHaveCount(50)
  await page.getByRole('button', { name: 'Load more' }).click()
  await expect(rows).toHaveCount(52)
  await expect(page.getByRole('button', { name: 'Load more' })).toBeHidden()

  await page.getByRole('searchbox', { name: 'Filter by address' }).fill('user07')
  await expect(page).toHaveURL(/[?&]email=user07/)
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('hard_bounce')
  await page
    .getByRole('button', { name: 'Remove user07@bounce.test from the suppression list' })
    .click()
  await expect(page.getByText('No suppressed address matches this filter.')).toBeVisible()
  expect((await ws.sink.suppressions.list({ email: 'user07' })).data).toEqual([])

  // The unfiltered list keeps its two loaded pages, without the removed address.
  await page.getByRole('searchbox', { name: 'Filter by address' }).fill('')
  await expect(rows).toHaveCount(51)
  await page.getByRole('button', { name: 'Reset the list' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Reset the suppression list?' })
  await dialog.getByRole('button', { name: 'Reset' }).click()
  await expect(page.getByText('The suppression list is empty.')).toBeVisible()
  expect((await ws.sink.suppressions.list()).data).toEqual([])

  await ingest.dispose()
  await ws.dispose()
})
