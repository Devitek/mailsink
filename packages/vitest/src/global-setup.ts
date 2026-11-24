// Vitest `globalSetup` entry: one ephemeral workspace for the whole run, handed to the
// tests through `provide` (read it with `injectMailsink()`), deleted at teardown.
import type { TestProject } from 'vitest/node'
import './vitest-types'
import { createEphemeralWorkspace, type EphemeralWorkspaceOptions } from './workspace'

type Provider = Pick<TestProject, 'provide'>

/**
 * A global setup function creating the workspace with `options`, for a custom
 * `globalSetup` file: `export default mailsinkGlobalSetup({ workspace: { name: 'CI' } })`.
 */
export function mailsinkGlobalSetup(options: EphemeralWorkspaceOptions = {}) {
  return async (project: Provider) => {
    const workspace = await createEphemeralWorkspace(options)
    project.provide('mailsink', {
      url: workspace.url,
      workspace: workspace.workspace,
      workspaceKey: workspace.workspaceKey,
      connections: workspace.connections,
    })
    return () => workspace.dispose()
  }
}

/** The default: `MAILSINK_URL`, `MAILSINK_ADMIN_KEY` and the default workspace. */
export default mailsinkGlobalSetup()
