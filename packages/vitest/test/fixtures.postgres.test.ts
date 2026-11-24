import { testDatabaseUrl } from '@mailsink/db/testing'
import { it } from 'vitest'
import { fixtureSuite } from './fixtures-suite'

// The fixture suite on Postgres (TEST_DATABASE_URL), skipped and reported without it.
if (testDatabaseUrl()) fixtureSuite('postgres')
else it.skip('mailsink fixture [postgres]: TEST_DATABASE_URL is not set')
