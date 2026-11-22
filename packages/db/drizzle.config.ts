import { defineConfig } from 'drizzle-kit'

// `pnpm --filter @mailsink/db db:generate` diffs src/schema against migrations/ and writes
// the next numbered migration. Generation needs no database.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  strict: true,
  verbose: true,
})
