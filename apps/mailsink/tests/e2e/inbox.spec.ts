import { booking, expect, test } from './inbox-fixtures'
import { signIn } from './ui/fixtures'
import { BASE_URL } from './web-server'

// The real-time inbox (#39) and the message viewer (#40) on the built server.

test('a message sent while the inbox is open appears without reload', async ({ page, inbox }) => {
  const ws = await inbox()
  await signIn(page)
  await page.goto(`/w/${ws.slug}`)
  await expect(page.getByRole('heading', { name: `Empty inbox for ${ws.slug}` })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'SSE Live' })).toBeVisible()

  // A marker on the window: a reload would drop it, so what shows up came through the stream.
  await page.evaluate(() => Object.assign(window, { inboxMarker: true }))
  await ws.send(booking)
  const list = page.getByRole('list', { name: 'Messages' })
  const row = list.getByRole('link', { name: booking.subject })
  await expect(row).toBeVisible()
  await expect(row).toContainText('See you tonight. Coach Malik expects you at 18:00.')
  await expect(row).toContainText('Resend')
  // The simulation runs in the background: its status reaches the open page too.
  await expect(row.getByText('delivered', { exact: true })).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Workspace' })
  await expect(nav.getByRole('link', { name: /Messages/ })).toContainText('1')

  await row.click()
  await expect(page).toHaveURL(new RegExp(`/w/${ws.slug}\\?m=msg_`))
  await expect(page.getByRole('heading', { name: booking.subject })).toBeVisible()
  expect(await page.evaluate(() => 'inboxMarker' in window)).toBe(true)
})

test('filters live in the URL and survive a reload', async ({ page, inbox }) => {
  const ws = await inbox()
  await ws.send(booking)
  await ws.send({
    ...booking,
    to: 'qa+reset@bounce.test',
    subject: 'Reset your password',
    tags: [],
  })
  await signIn(page)
  await page.goto(`/w/${ws.slug}`)
  const list = page.getByRole('list', { name: 'Messages' })
  await expect(list.getByRole('link')).toHaveCount(2)

  await page.getByRole('searchbox', { name: 'Search messages' }).fill('@bounce.test')
  await expect(page).toHaveURL(/q=%40bounce\.test/)
  await expect(list.getByRole('link')).toHaveCount(1)
  await expect(list.getByRole('link', { name: 'Reset your password' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('searchbox', { name: 'Search messages' })).toHaveValue('@bounce.test')
  await expect(list.getByRole('link')).toHaveCount(1)

  await page.getByRole('searchbox', { name: 'Search messages' }).fill('')
  await expect(list.getByRole('link')).toHaveCount(2)
  // A tag of the viewer filters the inbox.
  await list.getByRole('link', { name: booking.subject }).click()
  await page
    .getByRole('list', { name: 'Tags' })
    .getByRole('link', { name: 'category booking' })
    .click()
  await expect(page).toHaveURL(/tag=category%3Abooking/)
  await expect(list.getByRole('link')).toHaveCount(1)
  await page.getByRole('button', { name: 'Remove the tag filter category:booking' }).click()
  await expect(list.getByRole('link')).toHaveCount(2)
})

test('the viewer simulates events and shows every part of the message', async ({ page, inbox }) => {
  const ws = await inbox()
  const id = await ws.send(booking)
  await signIn(page)
  await page.goto(`/w/${ws.slug}?m=${id}`)
  await expect(page.getByRole('heading', { name: booking.subject })).toBeVisible()

  // Preview: sandboxed without any allowance, the captured script never runs.
  const frame = page.getByTitle('Email preview')
  await expect(frame).toHaveAttribute('sandbox', '')
  const preview = page.frameLocator('iframe[title="Email preview"]')
  await expect(preview.getByRole('heading', { name: 'See you tonight' })).toBeVisible()
  await expect(preview.locator('body')).not.toContainText('script ran')
  await page.getByRole('radio', { name: 'Mobile' }).click()
  await expect(page.getByText('iframe sandbox · scripts blocked · 375 px')).toBeVisible()

  await page.getByRole('tab', { name: 'Text' }).click()
  await expect(page).toHaveURL(/tab=text/)
  await expect(page.getByRole('tabpanel').getByText(booking.text)).toBeVisible()

  await page.getByRole('tab', { name: /Links & attachments/ }).click()
  await page
    .getByRole('button', { name: 'Simulate a click on https://livethewod.app/bookings/4821' })
    .click()
  await expect(page.getByText(/Events recorded: 1\./)).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download' }).click()
  expect((await download).suggestedFilename()).toBe('booking.ics')

  await page.getByRole('tab', { name: 'Headers & MIME' }).click()
  // The request that created the message first, then its MIME source.
  await expect(page.getByText(`"subject": "${booking.subject}"`)).toBeVisible()
  await page.getByRole('radio', { name: 'EML source' }).click()
  await expect(page.getByText(`Subject: ${booking.subject}`)).toBeVisible()

  await page.getByRole('button', { name: 'Hard Bounce' }).click()
  await expect(page.getByText('hard_bounce').first()).toBeVisible()
  await page.getByRole('tab', { name: /History/ }).click()
  await expect(page.getByText('clicked', { exact: true })).toBeVisible()
  await expect(page.getByText('https://livethewod.app/bookings/4821').first()).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'SSE Live' })).toBeVisible()
})

test('purging the inbox asks for confirmation', async ({ page, inbox }) => {
  const ws = await inbox()
  await ws.send(booking)
  await signIn(page)
  await page.goto(`/w/${ws.slug}`)
  await page.getByRole('button', { name: 'Purge the inbox' }).click()
  await page.getByRole('button', { name: 'Confirm the purge (1)' }).click()
  await expect(page.getByRole('heading', { name: `Empty inbox for ${ws.slug}` })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Messages' }).getByRole('link')).toHaveCount(0)
})

test('the session routes refuse a visitor without session', async ({ playwright, inbox }) => {
  const ws = await inbox()
  const id = await ws.send(booking)
  const anonymous = await playwright.request.newContext({ baseURL: BASE_URL })
  for (const path of [`/w/${ws.slug}/m/stream`, `/w/${ws.slug}/m/${id}/raw`]) {
    expect((await anonymous.get(path)).status()).toBe(401)
  }
  await anonymous.dispose()
})

// Light and dark captures for the PR (INBOX_SCREENSHOTS=<dir>), skipped otherwise.
test('screenshots of the inbox', async ({ page, inbox }) => {
  const dir = process.env.INBOX_SCREENSHOTS
  test.skip(!dir, 'INBOX_SCREENSHOTS not set')
  const ws = await inbox()
  await ws.send({ ...booking, to: 'qa+reset@bounce.test', subject: 'Reset your password' })
  await ws.send({ ...booking, to: 'thomas.leroy@outlook.test', subject: 'Invoice INV-2026-0412' })
  const id = await ws.send(booking)
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page)
  for (const theme of ['light', 'dark']) {
    await page.context().addCookies([{ name: 'mailsink_theme', value: theme, url: BASE_URL }])
    await page.goto(`/w/${ws.slug}?m=${id}`)
    await expect(page.getByRole('heading', { name: booking.subject })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Messages' }).getByText('delivered')).toHaveCount(3)
    await expect(page.getByRole('status').filter({ hasText: 'SSE Live' })).toBeVisible()
    await page.screenshot({ path: `${dir}/inbox-${theme}.png` })
    await page.getByRole('tab', { name: /History/ }).click()
    await expect(page.getByRole('heading', { name: 'Status timeline' })).toBeVisible()
    await page.screenshot({ path: `${dir}/inbox-history-${theme}.png` })
  }
})
