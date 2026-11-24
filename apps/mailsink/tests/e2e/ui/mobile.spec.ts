import { gotoHydrated } from '../goto-hydrated'
import { booking, expect, test } from '../inbox-fixtures'
import { signIn } from './fixtures'

// Navigation below 768 px (#106): the workspace tabs get a row of their own under the
// header, the inbox shows one pane at a time with « ← Inbox » back to the list.
test.use({ viewport: { width: 390, height: 844 } })

test('at 390 px the tabs stay reachable and the inbox shows one pane at a time', async ({
  page,
  inbox,
}) => {
  const ws = await inbox()
  await ws.send(booking)
  await signIn(page)
  await gotoHydrated(page, `/w/${ws.slug}`)
  await expect(page).toHaveTitle(`Inbox · ${ws.slug} · Mailsink`)

  const tabs = page.getByRole('navigation', { name: 'Workspace' })
  await expect(tabs).toHaveCount(1)
  await expect(tabs.getByRole('link', { name: /Messages/ })).toHaveAttribute('aria-current', 'page')
  await expect(tabs.getByRole('link', { name: 'Connections' })).toBeVisible()

  // The list alone, then the viewer alone, then back.
  const list = page.getByRole('list', { name: 'Messages' })
  const row = list.getByRole('link', { name: booking.subject })
  await expect(row).toBeVisible()
  await expect(page.getByRole('heading', { name: booking.subject })).toBeHidden()
  await row.click()
  await expect(page.getByRole('heading', { name: booking.subject })).toBeVisible()
  await expect(list).toBeHidden()
  await page.getByRole('link', { name: '← Inbox' }).click()
  await expect(list.getByRole('link', { name: booking.subject })).toBeVisible()
  await expect(page).toHaveURL(`/w/${ws.slug}`)

  // The page fits the screen: nothing scrolls sideways.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)

  await tabs.getByRole('link', { name: 'Connections' }).click()
  await expect(page).toHaveURL(`/w/${ws.slug}/connections`)
  await expect(page).toHaveTitle(`Connections · ${ws.slug} · Mailsink`)
  await expect(
    page.getByRole('navigation', { name: 'Workspace' }).getByRole('link', { name: 'Connections' }),
  ).toHaveAttribute('aria-current', 'page')
})
