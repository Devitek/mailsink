import { describeDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { stopRuntime } from '../runtime/boot'
import { getOpenApi, openApiDocumentFor } from './openapi'
import { installTestRuntime, request } from './test-fixtures'

describeDb('GET /openapi.json', (ctx) => {
  beforeAll(async () => {
    await installTestRuntime(ctx.handle, { publicUrl: 'https://mail.example.test' })
  })
  afterAll(() => stopRuntime())

  it('answers the document without credential, for the public URL', async () => {
    const response = await getOpenApi({ request: request('/openapi.json') })
    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(response.headers.get('x-request-id')).toMatch(/^req_/)
    const document = await response.json()
    expect(document.openapi).toBe('3.1.0')
    expect(document.servers).toEqual([{ url: 'https://mail.example.test' }])
    expect(document.paths['/openapi.json'].get.security).toEqual([])
  })

  it('builds the document once per public URL', () => {
    expect(openApiDocumentFor('https://a.test')).toBe(openApiDocumentFor('https://a.test'))
    expect(openApiDocumentFor('https://b.test').servers).toEqual([{ url: 'https://b.test' }])
  })
})
