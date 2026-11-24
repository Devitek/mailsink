// Test-only entry point of the app (`@mailsink/app/testing`): what the tests of other
// workspace packages (the SDK) need to run the real HTTP routes, without reaching into the
// app sources by relative paths. Never imported by the app itself.
export { ADMIN_KEY, installTestRuntime } from './http/test-fixtures'
export { stopRuntime } from './runtime/boot'

/** Folder of the file-based routes (`admin.workspaces.ts`...), one module per route. */
export const routesDir: URL = new URL('./routes/', import.meta.url)
