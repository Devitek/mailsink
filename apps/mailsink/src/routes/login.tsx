import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { getLoginState } from '../auth/auth-fns'
import { safeRedirect } from '../auth/redirect'
import { LoginScreen } from '../features/login/login-screen'

/** `?redirect=`: the page to return to (L1d); anything else is dropped. */
const LoginSearch = z.object({
  redirect: z
    .string()
    .optional()
    .catch(undefined)
    .transform((value) => safeRedirect(value)),
})

export const Route = createFileRoute('/login')({
  validateSearch: LoginSearch,
  // POST /login exchanges the admin key for the session cookie (03-contracts « Web UI
  // auth »). The handler, and the server module it imports, never reach the client bundle.
  server: {
    handlers: {
      POST: async ({ request }) => (await import('../auth/login-route.server')).postLogin(request),
    },
  },
  loaderDeps: ({ search }) => ({ redirect: search.redirect }),
  loader: async ({ deps }) => {
    const state = await getLoginState()
    // Nothing to sign in to: straight to the page asked for.
    if (state.auth === 'none' || state.status === 'signed-in') {
      throw redirect({ href: deps.redirect ?? state.home, replace: true })
    }
    return state
  },
  component: LoginPage,
})

function LoginPage() {
  const { status, home, retryAfter } = Route.useLoaderData()
  const { redirect: target } = Route.useSearch()
  return (
    <LoginScreen
      expired={status === 'expired'}
      redirect={target}
      home={home}
      initialRetryAfter={retryAfter}
    />
  )
}
