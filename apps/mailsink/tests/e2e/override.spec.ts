import { randomUUID } from 'node:crypto'
import { gotoHydrated } from './goto-hydrated'
import { expect, signIn, test } from './ui/fixtures'
import { createWorkspace } from './workspace-api'

// Override panel (#42): the header pill, the panel (target, expiry, rates with the remainder
// shown as delivered, validation), apply and reset through session-checked server
// functions, and the pill kept live by `override.changed` frames from the Capture API.

test('applies a workspace override from the panel, then resets it from the pill', async ({
  page,
}) => {
  const ws = await createWorkspace(`ovr ${randomUUID().slice(0, 8)}`)
  await signIn(page)
  await gotoHydrated(page, `/w/${ws.slug}`)

  const header = page.getByRole('banner')
  await header.getByRole('button', { name: 'Override…' }).click()
  const panel = page.getByRole('dialog', { name: 'Override settings' })
  await expect(panel.getByRole('button', { name: 'Whole workspace' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  // Nothing turned on: nothing to apply.
  await panel.getByRole('button', { name: 'Apply the override' }).click()
  await expect(panel.getByRole('alert')).toHaveText('Turn on at least one setting to override.')

  await panel.getByRole('switch', { name: 'Override the status rates' }).click()
  await panel.getByRole('textbox', { name: 'hard_bounce rate' }).fill('80')
  await panel.getByRole('textbox', { name: 'failed rate' }).fill('30')
  await expect(panel.getByRole('alert')).toContainText('Total above 100 % (+10 %)')
  await expect(panel.getByRole('button', { name: 'Apply the override' })).toBeDisabled()
  await panel.getByRole('textbox', { name: 'failed rate' }).fill('5')
  await expect(panel.getByTestId('delivered-remainder')).toHaveText('15 %')

  await panel.getByRole('switch', { name: 'Override the recipient rules' }).click()
  await panel.getByRole('button', { name: '+ Rule' }).click()
  await panel.getByRole('textbox', { name: 'Pattern of rule 1' }).fill('*@slow.test')
  await panel.getByRole('combobox', { name: 'Effect of rule 1' }).click()
  await page.getByRole('option', { name: 'delay +ms' }).click()
  await panel.getByRole('textbox', { name: 'Delay of rule 1' }).fill('2000')
  await panel.getByRole('radio', { name: '15 min' }).click()
  await panel.getByRole('button', { name: 'Apply the override' }).click()
  await expect(panel).toBeHidden()

  const pill = header.getByTestId('override-pill')
  await expect(pill).toContainText('Override active')
  await expect(pill).toContainText('workspace')
  const state = await ws.sink.overrides.get()
  expect(state.workspace).toMatchObject({
    activatedVia: 'ui',
    config: {
      rates: { delivered: 15, hard_bounce: 80, failed: 5 },
      rules: [{ match: '*@slow.test', delayMs: 2000 }],
    },
  })
  const { expiresAt, createdAt } = state.workspace ?? {}
  expect(Date.parse(expiresAt ?? '') - Date.parse(createdAt ?? '')).toBe(900_000)

  await pill.getByRole('button', { name: 'Reset the override' }).click()
  await expect(header.getByRole('button', { name: 'Override…' })).toBeVisible()
  expect((await ws.sink.overrides.get()).workspace).toBeNull()
  await ws.dispose()
})

test('follows overrides changed through the Capture API, and resets one target', async ({
  page,
}) => {
  const ws = await createWorkspace(`ovr ${randomUUID().slice(0, 8)}`)
  const { connection } = ws
  await signIn(page)
  await gotoHydrated(page, `/w/${ws.slug}`)
  const header = page.getByRole('banner')
  await expect(header.getByRole('button', { name: 'Override…' })).toBeVisible()
  await expect(header.getByText('SSE Live')).toBeVisible()

  // Activated by a test runner: the pill turns on without a reload.
  await ws.sink.overrides.activate({ chaos: { errorRate: 50 } }, { connectionId: connection.id })
  const pill = header.getByTestId('override-pill')
  await expect(pill).toContainText(connection.name)

  await pill.getByRole('button', { name: /^Override active/ }).click()
  const panel = page.getByRole('dialog', { name: 'Override settings' })
  await expect(panel.getByRole('button', { name: connection.name })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(panel.getByRole('switch', { name: 'Override the chaos' })).toBeChecked()
  await expect(panel.getByLabel('errorRate')).toHaveValue('50')
  await expect(panel.getByRole('button', { name: '500' })).toHaveAttribute('aria-pressed', 'true')

  await panel.getByRole('button', { name: 'Reset to defaults' }).click()
  await panel.getByRole('button', { name: 'Cancel' }).click()
  await panel.getByRole('button', { name: 'Reset to defaults' }).click()
  await panel.getByRole('button', { name: 'Confirm the reset' }).click()
  await expect(panel).toBeHidden()
  await expect(header.getByRole('button', { name: 'Override…' })).toBeVisible()
  expect((await ws.sink.overrides.get()).connections).toEqual([])
  await ws.dispose()
})
