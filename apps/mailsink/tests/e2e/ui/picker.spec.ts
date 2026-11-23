import { ADMIN_KEY, expect, lastActivityAt, signIn, test } from './fixtures'

// Workspace picker (`/`, header popover) and direct access to `/w/$workspaceSlug`.

test('the picker hides ephemeral workspaces until the switch reveals them', async ({
  page,
  workspace,
}) => {
  const qa = await workspace()
  const ci = await workspace({ ephemeral: true })
  await signIn(page)
  await page.goto('/')

  const persistent = page.getByRole('navigation', { name: 'Persistent workspaces' })
  await expect(persistent.getByRole('link', { name: qa.slug })).toBeVisible()
  await expect(page.getByRole('link', { name: ci.slug })).toHaveCount(0)
  await expect(page.getByText(/\d+ created through the Admin API/)).toBeVisible()

  const toggle = page.getByRole('switch', { name: 'Show ephemeral workspaces' })
  await expect(toggle).not.toBeChecked()
  await toggle.click()
  await expect(page).toHaveURL('/?ephemeral=true')
  const ephemeral = page.getByRole('navigation', { name: 'Ephemeral workspaces' })
  await expect(ephemeral.getByRole('link', { name: ci.slug })).toBeVisible()

  // The URL carries the switch: a reload (server render) keeps it on.
  await page.reload()
  await expect(page.getByRole('switch', { name: 'Show ephemeral workspaces' })).toBeChecked()
  await ephemeral.getByRole('link', { name: ci.slug }).click()
  await expect(page).toHaveURL(`/w/${ci.slug}`)
  await expect(page.getByRole('heading', { name: ci.name })).toBeVisible()

  // The TTL banner of an ephemeral workspace, under the header.
  const banner = page.getByRole('region', { name: 'Ephemeral workspace' })
  await expect(banner).toContainText('Purged in')
  await expect(banner).toContainText('TTL 10m')
})

test('the picker searches by slug or name across both sections', async ({ page, workspace }) => {
  const qa = await workspace()
  const ci = await workspace({ ephemeral: true })
  await signIn(page)
  await page.goto('/?ephemeral=true')

  await page.getByRole('searchbox', { name: 'Search workspaces' }).fill(ci.slug)
  const ephemeral = page.getByRole('navigation', { name: 'Ephemeral workspaces' })
  await expect(ephemeral.getByRole('link', { name: ci.slug })).toBeVisible()
  const persistent = page.getByRole('navigation', { name: 'Persistent workspaces' })
  await expect(persistent.getByRole('link')).toHaveCount(0)
  await expect(persistent.getByText('No workspace matches.')).toBeVisible()

  await page.getByRole('searchbox', { name: 'Search workspaces' }).fill(qa.name)
  await expect(persistent.getByRole('link', { name: qa.slug })).toBeVisible()
  await expect(ephemeral.getByRole('link')).toHaveCount(0)
})

test('opening a workspace touches its activity and makes it the next home', async ({
  page,
  admin,
  workspace,
}) => {
  const ws = await workspace({ ephemeral: true })
  const before = await lastActivityAt(admin, ws.id)
  await signIn(page)
  await page.goto(`/w/${ws.slug}`)
  await expect(page.getByRole('heading', { name: ws.name })).toBeVisible()
  await expect.poll(() => lastActivityAt(admin, ws.id)).toBeGreaterThan(before)

  // After signing out and in again without a page to return to: the last workspace.
  await page.context().clearCookies({ name: 'mailsink_session' })
  await page.goto('/login')
  await page.getByLabel('Admin key').fill(ADMIN_KEY)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(`/w/${ws.slug}`)
})

test('the header picker switches workspace; an unknown slug answers 404', async ({
  page,
  workspace,
}) => {
  const first = await workspace()
  const second = await workspace()
  await signIn(page)
  await page.goto(`/w/${first.slug}`)

  const banner = page.getByRole('banner')
  await banner.getByRole('button', { name: `Workspace: ${first.slug}` }).click()
  const popover = page.getByRole('dialog')
  await expect(popover.getByRole('link', { name: first.slug })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await popover.getByRole('link', { name: second.slug }).click()
  await expect(page).toHaveURL(`/w/${second.slug}`)
  await expect(popover).toHaveCount(0)
  await expect(banner.getByRole('link', { name: 'Messages' })).toHaveAttribute(
    'aria-current',
    'page',
  )

  const missing = await page.goto('/w/no-such-workspace')
  expect(missing?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Workspace not found' })).toBeVisible()
})
