// Runs the Jest example project (`jest-project/`) against the in-process server: the Jest
// entry is bundled first (plain ESM, the SDK inlined), as the published package would be.
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describeDb } from '@mailsink/db/testing'
import { build } from 'tsdown'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { ADMIN_KEY, useHarness } from './support'

const here = import.meta.dirname
const jestBin = createRequire(import.meta.url).resolve('jest/bin/jest')

interface JestReport {
  numPassedTests: number
  numFailedTests: number
  testResults: { message: string }[]
}

function runJest(
  args: string[],
  env: Record<string, string>,
): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--experimental-vm-modules', '--no-warnings', jestBin, '--ci', '--json', ...args],
      { cwd: join(here, 'jest-project'), env: { ...process.env, ...env } },
    )
    let output = ''
    child.stdout.on('data', (chunk) => {
      output += chunk
    })
    child.stderr.on('data', (chunk) => {
      output += chunk
    })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, output }))
  })
}

let outDir = ''
beforeAll(async () => {
  outDir = await mkdtemp(join(tmpdir(), 'mailsink-jest-'))
  await build({
    config: false,
    entry: { jest: join(here, '../src/jest.ts') },
    outDir,
    format: 'esm',
    platform: 'node',
    fixedExtension: false,
    dts: false,
    logLevel: 'silent',
    deps: { alwaysBundle: [/./] },
  })
}, 60_000)
afterAll(() => rm(outDir, { recursive: true, force: true }))

describeDb('Jest example project', (ctx) => {
  const h = useHarness(ctx)

  it('runs with the matchers and a workspace per file, deleted afterwards', async () => {
    const reportFile = join(outDir, 'report.json')
    const { code, output } = await runJest([`--outputFile=${reportFile}`], {
      MAILSINK_JEST_BUNDLE: join(outDir, 'jest.js'),
      MAILSINK_URL: h.server.url,
      MAILSINK_ADMIN_KEY: ADMIN_KEY,
    })
    const report = JSON.parse(await readFile(reportFile, 'utf8').catch(() => '{}')) as JestReport
    expect(report.numPassedTests, output).toBe(3)
    expect(report.numFailedTests).toBe(0)
    expect(code).toBe(0)

    const left = await h.admin.admin.workspaces.list({ includeEphemeral: true, limit: 100 })
    expect(left.data.map((w) => w.name)).not.toContain('Acme Jest')
  }, 60_000)
})
