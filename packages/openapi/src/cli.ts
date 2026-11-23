// `pnpm openapi [file]`: writes the OpenAPI document (default `openapi.json`), the file
// attached to each GitHub release. Relative paths resolve from where pnpm was invoked.
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createOpenApiDocument } from './document'

const target = resolve(process.env.INIT_CWD ?? process.cwd(), process.argv[2] ?? 'openapi.json')
const document = createOpenApiDocument({ serverUrl: process.env.MAILSINK_PUBLIC_URL })
writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`)
console.log(
  `OpenAPI ${document.info.version}: ${Object.keys(document.paths ?? {}).length} paths -> ${target}`,
)
