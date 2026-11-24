import { expect, it } from 'vitest'
import { injectMailsink } from '../src'
import { fixtureSuite } from './fixtures-suite'

// The fixture suite on PGlite; fixtures.postgres.test.ts runs it on Postgres.
fixtureSuite('pglite')

it('injectMailsink explains a missing global setup', () => {
  expect(() => injectMailsink()).toThrow('add @devitek/mailsink-vitest/global-setup')
})
