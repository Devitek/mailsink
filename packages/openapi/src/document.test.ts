import { MAILSINK_VERSION } from '@mailsink/contracts'
import { compileErrors, validate } from '@readme/openapi-parser'
import { describe, expect, it } from 'vitest'
import { createOpenApiDocument } from './document'
import { ROUTES } from './registry'

const document = createOpenApiDocument({ serverUrl: 'https://mail.example.test' })

describe('createOpenApiDocument', () => {
  it('is a valid OpenAPI 3.1 document', async () => {
    // The parser dereferences in place: validate a copy.
    const result = await validate(structuredClone(document) as never)
    expect(result.valid, result.valid ? '' : compileErrors(result)).toBe(true)
    expect(result.warnings).toEqual([])
  })

  it('carries the release version and the instance URL', () => {
    expect(document.openapi).toBe('3.1.0')
    expect(document.info.version).toBe(MAILSINK_VERSION)
    expect(document.servers?.[0]?.url).toBe('https://mail.example.test')
  })

  it('has one operation per registry entry, with unique operation ids', () => {
    const ids = ROUTES.map((route) => route.operationId)
    expect(new Set(ids).size).toBe(ids.length)
    for (const route of ROUTES) {
      expect(document.paths?.[route.path]?.[route.method]?.operationId).toBe(route.operationId)
    }
  })

  it('declares the credentials of D41', () => {
    expect(Object.keys(document.components?.securitySchemes ?? {})).toEqual([
      'adminKey',
      'connectionKey',
      'workspaceKey',
      'brevoApiKey',
      'workspaceHeader',
    ])
    expect(document.paths?.['/capture/messages']?.get?.security).toContainEqual({
      adminKey: [],
      workspaceHeader: [],
    })
    expect(document.paths?.['/healthz']?.get?.security).toEqual([])
  })

  it('names the components after the contracts', () => {
    const schemas = Object.keys(document.components?.schemas ?? {})
    for (const name of ['ApiErrorBody', 'MessageDetail', 'StreamEvent', 'BrevoSendResponse']) {
      expect(schemas).toContain(name)
    }
  })

  it('describes the rate limit headers and dialect errors of ingestion', () => {
    const send = document.paths?.['/v3/smtp/email']?.post
    expect(Object.keys(send?.responses?.['201']?.headers ?? {})).toContain('X-RateLimit-Limit')
    expect(Object.keys(send?.responses?.['429']?.headers ?? {})).toContain('Retry-After')
    expect(send?.responses?.['400']?.content?.['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/BrevoError',
    })
  })

  it('describes the stream as text/event-stream', () => {
    const stream = document.paths?.['/capture/stream']?.get?.responses?.['200']
    expect(Object.keys(stream?.content ?? {})).toEqual(['text/event-stream'])
  })

  it('documents the outgoing webhook payloads', () => {
    expect(Object.keys(document.webhooks ?? {})).toEqual(['unified', 'resend', 'brevo'])
  })
})
