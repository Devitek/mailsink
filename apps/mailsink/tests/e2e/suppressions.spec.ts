import { randomUUID } from 'node:crypto'
import { createWorkspace } from './recipe/fixtures'
import { expect, signIn, test } from './ui/fixtures'
import { BASE_URL } from './web-server'

// Suppression list (#42): fed by the simulation (a recipient rule forcing hard_bounce),
// read by pages of 50 with « Load more », filtered by address (kept in the URL), one
// address removed, then the whole list reset after a confirmation.

test('pages, filters, removes and resets the suppression list', async ({
  page,
  playwright,
  admin,
}) => {
  test.slow()
  const ws = await createWorkspace(playwright, admin, `sup ${randomUUID().slice(0, 8)}`)
  const slug = (await (await admin.get(`/admin/workspaces/${ws.id}`)).json()).slug
  const rule = await ws.capture.post('/capture/override', {
    data: { config: { rules: [{ match: '*@bounce.test', status: 'hard_bounce' }] } },
  })
  expect(rule.ok(), await rule.text()).toBe(true)
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
    .poll(
      async () =>
        (await (await ws.capture.get('/capture/suppressions?limit=100')).json()).data.length,
      {
        timeout: 30_000,
      },
    )
    .toBe(52)

  await signIn(page)
  await page.goto(`/w/${slug}/suppressions`)
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
  const left = await (await ws.capture.get('/capture/suppressions?email=user07')).json()
  expect(left.data).toEqual([])

  // The unfiltered list keeps its two loaded pages, without the removed address.
  await page.getByRole('searchbox', { name: 'Filter by address' }).fill('')
  await expect(rows).toHaveCount(51)
  await page.getByRole('button', { name: 'Reset the list' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Reset the suppression list?' })
  await dialog.getByRole('button', { name: 'Reset' }).click()
  await expect(page.getByText('The suppression list is empty.')).toBeVisible()
  expect((await (await ws.capture.get('/capture/suppressions')).json()).data).toEqual([])

  await ingest.dispose()
  await ws.dispose()
})
