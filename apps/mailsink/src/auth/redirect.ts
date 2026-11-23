/**
 * Page to return to after signing in (L1d): only a path of this app, never another origin
 * (`//host`, `/\host`, a scheme) nor the sign-in page itself. Undefined otherwise.
 */
export function safeRedirect(value: string | undefined): string | undefined {
  if (!value?.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return
  const path = value.split(/[?#]/)[0]
  if (path === '/login') return
  return value
}
