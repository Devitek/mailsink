import { msg } from '@lingui/core/macro'
import { SuppressionsSearch } from '@mailsink/contracts'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { suppressionsQuery } from '../features/suppressions/queries'
import { SuppressionsScreen } from '../features/suppressions/suppressions-screen'
import { pageTitle } from '../seo/page-title'

// `/w/$workspaceSlug/suppressions` (#42): the suppression list of the workspace, rendered in
// the workspace layout (header, tabs, live stream), which already checks the session and
// answers « workspace not found ». `?email=` filters the addresses.
export const Route = createFileRoute('/w/$workspaceSlug/suppressions')({
  validateSearch: SuppressionsSearch,
  loaderDeps: ({ search }) => ({ email: search.email }),
  loader: ({ context, params, deps }) =>
    context.queryClient.ensureInfiniteQueryData(
      suppressionsQuery(params.workspaceSlug, deps.email),
    ),
  head: ({ matches }) => ({ meta: [pageTitle(matches, msg`Suppression list`)] }),
  component: SuppressionsRoute,
})

function SuppressionsRoute() {
  const { workspaceSlug } = Route.useParams()
  const { email } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const onEmail = useCallback(
    (next: string | undefined) => void navigate({ search: { email: next }, replace: true }),
    [navigate],
  )
  return <SuppressionsScreen slug={workspaceSlug} email={email} onEmail={onEmail} />
}
