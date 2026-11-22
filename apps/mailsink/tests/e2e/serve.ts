import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// Starts a production build (`node <entry>`) on a throwaway PGlite directory, removed when
// the server exits. Run by the Playwright webServer: `node tests/e2e/serve.ts <entry>`.
// PORT and MAILSINK_SMTP_PORT come from the webServer env.

const entry = resolve(process.argv[2] ?? '.output/server/index.mjs')
if (!existsSync(entry)) {
  console.error(`[e2e] ${entry} not found: run \`pnpm build\` first.`)
  process.exit(1)
}

const dataDir = mkdtempSync(join(tmpdir(), 'mailsink-e2e-'))
const server = spawn(process.execPath, [entry], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: `pglite://${dataDir}` },
})

// Playwright signals the whole process group: the server receives SIGTERM too, so this
// process only waits for it to exit before cleaning up.
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {})

server.on('exit', (code, signal) => {
  rmSync(dataDir, { recursive: true, force: true })
  process.exit(code ?? (signal ? 1 : 0))
})
