import { redirect } from '@tanstack/react-router'
import { getSessionStatus } from './auth-fns'

/**
 * `beforeLoad` of every signed-in page: without a valid session, off to the sign-in page,
 * which returns here afterwards (L1d). With `MAILSINK_UI_AUTH=none` everyone is signed in.
 */
export async function ensureSignedIn(location: { href: string }): Promise<void> {
  const { status } = await getSessionStatus()
  if (status !== 'signed-in') {
    throw redirect({ to: '/login', search: { redirect: location.href } })
  }
}
