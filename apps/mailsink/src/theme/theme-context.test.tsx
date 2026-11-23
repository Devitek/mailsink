import { renderToString } from 'react-dom/server'
import { expect, it, vi } from 'vitest'

vi.mock('./theme-fns', () => ({ setTheme: async () => {} }))

type ThemeModule = typeof import('./theme-context')

function Probe({ hook }: Readonly<{ hook: ThemeModule['useTheme'] }>) {
  return <span>{hook().theme}</span>
}

it('keeps one theme context across re-evaluations of the module (HMR, #86)', async () => {
  const before = await import('./theme-context')
  vi.resetModules()
  const after = await import('./theme-context')
  expect(after).not.toBe(before)

  const html = renderToString(
    <before.ThemeProvider initialTheme="dark">
      <Probe hook={after.useTheme} />
    </before.ThemeProvider>,
  )
  expect(html).toContain('dark')
})
