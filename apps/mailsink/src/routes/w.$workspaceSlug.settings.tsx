import { msg } from '@lingui/core/macro'
import { SettingsSearch } from '@mailsink/contracts'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { settingsQuery } from '../features/settings/queries'
import { SettingsScreen } from '../features/settings/settings-screen'
import { templatesQuery } from '../features/templates/queries'
import { endpointsQuery } from '../features/webhooks/queries'
import { pageTitle } from '../seo/page-title'

// `/w/$workspaceSlug/settings` (#43, prototype « Paramètres »): one section at a time
// (`?section=`), rendered in the workspace layout, which checks the session and answers
// « workspace not found ». The open section's data is prefetched during SSR.
export const Route = createFileRoute('/w/$workspaceSlug/settings')({
  validateSearch: SettingsSearch,
  loaderDeps: ({ search }) => ({ section: search.section ?? 'connections' }),
  loader: async ({ context, params, deps }) => {
    const slug = params.workspaceSlug
    const page = await context.queryClient.ensureQueryData(settingsQuery(slug))
    if (!page) throw notFound()
    if (deps.section === 'webhooks') await context.queryClient.ensureQueryData(endpointsQuery(slug))
    if (deps.section === 'templates')
      await context.queryClient.ensureQueryData(templatesQuery(slug))
  },
  head: ({ matches }) => ({ meta: [pageTitle(matches, msg`Settings`)] }),
  component: SettingsRoute,
})

function SettingsRoute() {
  const { workspaceSlug } = Route.useParams()
  const { section = 'connections' } = Route.useSearch()
  const { data: page } = useSuspenseQuery(settingsQuery(workspaceSlug))
  return page ? <SettingsScreen page={page} section={section} /> : null
}
