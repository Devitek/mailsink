// Jest entry point (no Vitest import): matchers and one ephemeral workspace per test file.
import { mailsinkMatchers } from './matchers'
import {
  createEphemeralWorkspace,
  type EphemeralWorkspaceOptions,
  type MailsinkWorkspace,
} from './workspace'

export * from './matchers'
export * from './workspace'

type Hook = (fn: () => Promise<void>, timeout?: number) => void
export interface Hooks {
  beforeAll: Hook
  afterAll: Hook
}

interface Expect {
  extend(matchers: Record<string, unknown>): void
}

// Kept on globalThis so a setup file and the test file share it even when a bundler
// duplicated this module.
const CURRENT = Symbol.for('@devitek/mailsink-vitest/current-workspace')
type Slot = { [CURRENT]?: MailsinkWorkspace }

const globalHooks = (): Hooks => {
  const g = globalThis as unknown as Partial<Hooks>
  if (!g.beforeAll || !g.afterAll) {
    throw new Error('Mailsink: no global beforeAll/afterAll, pass them as the `hooks` argument')
  }
  return { beforeAll: g.beforeAll, afterAll: g.afterAll }
}

/** Registers the matchers on `expect` (the global one by default). */
export function installMailsinkMatchers(expect?: Expect): void {
  const target = expect ?? (globalThis as unknown as { expect?: Expect }).expect
  if (!target) throw new Error('Mailsink: no global expect, pass it to installMailsinkMatchers')
  target.extend(mailsinkMatchers)
}

/**
 * Creates an ephemeral workspace before the tests of the file and deletes it after them.
 * Call it at the top of a test file, or in a `setupFilesAfterEnv` module (it then runs for
 * every test file). Answers the handle; `mailsinkWorkspace()` answers it too.
 */
export function useMailsinkWorkspace(
  options: EphemeralWorkspaceOptions = {},
  hooks: Hooks = globalHooks(),
  timeout = 30_000,
): MailsinkWorkspace {
  const slot = globalThis as Slot
  hooks.beforeAll(async () => {
    slot[CURRENT] = await createEphemeralWorkspace(options)
  }, timeout)
  hooks.afterAll(async () => {
    const workspace = slot[CURRENT]
    slot[CURRENT] = undefined
    await workspace?.dispose()
  }, timeout)
  return new Proxy({} as MailsinkWorkspace, {
    // `then` stays undefined so the handle is not mistaken for a promise.
    get: (_, key) => (key === 'then' ? undefined : Reflect.get(mailsinkWorkspace(), key)),
  })
}

/** The workspace of `useMailsinkWorkspace`, once its `beforeAll` ran. */
export function mailsinkWorkspace(): MailsinkWorkspace {
  const workspace = (globalThis as Slot)[CURRENT]
  if (!workspace) {
    throw new Error('Mailsink: no workspace yet, call useMailsinkWorkspace() and read it in tests')
  }
  return workspace
}
