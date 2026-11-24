import { gotoHydrated } from '../goto-hydrated'
import { expect, signIn, test } from './fixtures'

// Ephemeral banner (#131, #132): the countdown to the GC purge runs on the server clock,
// measured from the Date header of /healthz (D261), so a browser clock 30 minutes ahead
// still shows the ten minutes of idle TTL left instead of « 0m 00s ».

test('the ephemeral countdown follows the server clock, not a skewed browser', async ({
  page,
  workspace,
}) => {
  const ws = await workspace({ ephemeral: true })
  // `Date.now` only: Playwright's fake clock (`page.clock`) also stalls React's renders.
  await page.addInitScript(() => {
    const real = Date.now
    Date.now = () => real() + 30 * 60_000
  })
  await signIn(page)
  await gotoHydrated(page, `/w/${ws.slug}`)
  // A skewed clock would freeze the server render (every tick computes « 0m 00s »): the
  // countdown must tick, and stay within the ten minutes of idle TTL.
  const banner = page.getByRole('region', { name: 'Ephemeral workspace' })
  const countdown = banner.getByText(/^\d+m \d{2}s$/)
  const first = (await countdown.textContent()) ?? ''
  await expect(countdown).not.toHaveText(first)
  await expect(countdown).toHaveText(/^(9m \d{2}s|10m 00s)$/)
})
