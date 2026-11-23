// Workspace pages added by other Phase 4 lots (logs explorer, settings, connections). Plain
// paths until their routes exist in the route tree; then typed links can replace them.

const base = (slug: string) => `/w/${encodeURIComponent(slug)}`

export const workspacePagePaths = {
  logs: (slug: string) => `${base(slug)}/logs`,
  webhookLogs: (slug: string) => `${base(slug)}/logs?tab=webhooks`,
  settings: (slug: string) => `${base(slug)}/settings`,
  connections: (slug: string) => `${base(slug)}/connections`,
}
