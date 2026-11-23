import { randomUUID } from 'node:crypto'
import { createServer, type IncomingHttpHeaders } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Page } from '@playwright/test'
import { deleteWorkspace } from './recipe/fixtures'
import { expect, test as ui } from './ui/fixtures'

// Fixtures of the settings scenarios (#43): a workspace with a Resend and an SMTP
// connection (deleted afterwards) and a local webhook receiver (nothing leaves the host).

export type SettingsWorkspace = { id: string; slug: string }
type Received = { headers: IncomingHttpHeaders; body: string }

export const test = ui.extend<{ settingsWorkspace: SettingsWorkspace }>({
  settingsWorkspace: async ({ admin }, use) => {
    const res = await admin.post('/admin/workspaces', {
      data: {
        name: `settings ${randomUUID().slice(0, 8)}`,
        connections: [
          { kind: 'resend', name: 'resend-main' },
          { kind: 'smtp', name: 'smtp-legacy' },
        ],
      },
    })
    expect(res.status(), await res.text()).toBe(201)
    const { workspace } = await res.json()
    await use({ id: workspace.id, slug: workspace.slug })
    await deleteWorkspace(admin, workspace.id)
  },
})

/**
 * Opens a settings section once the page is hydrated: the stream status turns live only in
 * the browser, so a click after it never lands on the inert server HTML (#118, a click
 * lost on a loaded host left a dialog closed).
 */
export async function openSettings(page: Page, slug: string, section: string): Promise<void> {
  await page.goto(`/w/${slug}/settings?section=${section}`)
  await expect(page.getByRole('status').filter({ hasText: 'SSE Live' })).toBeVisible()
}

export async function startReceiver() {
  const received: Received[] = []
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      received.push({ headers: req.headers, body })
      res.writeHead(200).end()
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}/hooks`,
    received,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

export { expect }
