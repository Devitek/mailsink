// A small Jest project run by `../jest.test.ts` (`*.jest.mjs`, out of Vitest's include): plain
// ESM, no transform. The helpers are the bundle of `src/jest.ts` the test builds into
// MAILSINK_JEST_BUNDLE.
const bundle = process.env.MAILSINK_JEST_BUNDLE
if (!bundle) throw new Error('MAILSINK_JEST_BUNDLE is not set')

export default {
  rootDir: import.meta.dirname,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/*.jest.mjs'],
  transform: {},
  moduleNameMapper: { '^@devitek/mailsink-vitest/jest$': bundle },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.mjs'],
}
