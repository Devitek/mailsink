import { createServerFn } from '@tanstack/react-start'
import pkg from '../../package.json'
import { uiAuth } from '../auth/session'
import { whenRuntimeReady } from '../runtime/slot'

export type InstanceInfo = {
  version: string
  auth: 'admin-key' | 'none'
}

// Static facts of the instance read once by the root loader, next to MAILSINK_PUBLIC_URL:
// the instance block of the sign-in screen and of the « Language and session » menu.
export const getInstanceInfo = createServerFn({ method: 'GET' }).handler(
  async (): Promise<InstanceInfo> => {
    const { config } = await whenRuntimeReady()
    return { version: pkg.version, auth: uiAuth(config).auth }
  },
)
