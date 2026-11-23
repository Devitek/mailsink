// Workspace pages of other Phase 4 lots (logs explorer, settings) that are not in the route
// tree of main yet: plain paths until then, typed `Link`s replace them once the routes exist.
// The connections page has its route: link to it with `<Link to="/w/$workspaceSlug/connections">`.

const base = (slug: string) => `/w/${encodeURIComponent(slug)}`

export const workspacePagePaths = {
  logs: (slug: string) => `${base(slug)}/logs`,
  webhookLogs: (slug: string) => `${base(slug)}/logs?tab=webhooks`,
  settings: (slug: string) => `${base(slug)}/settings`,
}
