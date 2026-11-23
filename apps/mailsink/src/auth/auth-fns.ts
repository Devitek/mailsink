import { createServerFn } from '@tanstack/react-start'
import { lastWorkspaceHome } from '../server-fns/workspaces.server'
import type { SessionStatus } from './session'
import { uiAuth } from './session'
import { clearSession, clientAddress, loginLimiter, readSession } from './session.server'

// Server functions of the UI session. The Start compiler strips the handlers, and the
// *.server imports, from the client bundle.

export type UiAuthMode = 'admin-key' | 'none'

/** Route guards: one cookie check per navigation. */
export const getSessionStatus = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ status: SessionStatus }> => ({ status: (await readSession()).status }),
)

export type LoginState = {
  auth: UiAuthMode
  status: SessionStatus
  /** Seconds of an ongoing pause of this client (L1e survives a reload). */
  retryAfter: number
  /** Where to go after signing in without a page to return to: the last workspace, or `/`. */
  home: string
}

export const getLoginState = createServerFn({ method: 'GET' }).handler(
  async (): Promise<LoginState> => {
    const { runtime, status } = await readSession()
    return {
      auth: uiAuth(runtime.config).auth,
      status,
      retryAfter: loginLimiter(runtime).retryAfter(await clientAddress(runtime)),
      home: await lastWorkspaceHome(runtime),
    }
  },
)

/** Stateless sessions: signing out drops the cookie of this browser. */
export const signOut = createServerFn({ method: 'POST' }).handler(async () => {
  await clearSession()
})
