import { gotoHydrated } from '../goto-hydrated'
import { expect, signIn, test } from './fixtures'

// Workspace key rotation from the connections page (#106) and the copy toast.
test('rotates the mskw_ key: the new one reads the Capture API, the old one is refused', async ({
  page,
  context,
  workspace,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const ws = await workspace()
  await signIn(page)
  await gotoHydrated(page, `/w/${ws.slug}/connections`)

  const card = page.getByRole('region', { name: 'Workspace key' })
  await expect(card).toContainText('mskw_')
  const rotate = async () => {
    await card.getByRole('button', { name: 'Rotate' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Rotate the key' }).click()
  }
  await rotate()
  const value = card.getByTestId('workspace-key-value')
  await expect(value).toContainText('mskw_')
  const first = (await value.textContent()) ?? ''

  const capture = (key: string) =>
    page.request.get('/capture/messages', { headers: { authorization: `Bearer ${key}` } })
  expect((await capture(first)).status()).toBe(200)

  await card.getByRole('button', { name: 'Copy the workspace key' }).click()
  await expect(page.getByText('Copied to the clipboard')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(first)

  await rotate()
  await expect(value).not.toHaveText(first)
  expect((await capture(first)).status()).toBe(401)
  expect((await capture((await value.textContent()) ?? '')).status()).toBe(200)
})
