// Smoke test of the packed SDK on every supported Node version (ci.yml, matrix 20/22/24):
// the tarball installed in an empty project, imported by its public name, driven through
// a fake `fetch`. The full SDK suite needs the server stack (Node 24, Vitest); this one
// only needs `node:assert`, so it runs where Vitest cannot (Node 20).
//   cp sdk-smoke.mjs <consumer>/ && node <consumer>/sdk-smoke.mjs
import assert from 'node:assert/strict'
import {
  createMailsink,
  extractCode,
  extractLinks,
  findLink,
  isMailsinkError,
} from '@devitek/mailsink'

const seen = []
const fakeFetch = async (input, init) => {
  const request = new Request(input, init)
  seen.push(request)
  const { pathname } = new URL(request.url)
  if (pathname === '/prefix/capture/messages')
    return Response.json({ data: [], nextCursor: null }, { headers: { 'x-request-id': 'req_1' } })
  return Response.json(
    { error: { code: 'not_found', message: 'Message not found' }, requestId: 'req_2' },
    { status: 404 },
  )
}

const sink = createMailsink({
  url: 'http://mailsink.test/prefix',
  key: 'mskw_example',
  fetch: fakeFetch,
})

// A request: base path kept, bearer key, query string encoded.
const page = await sink.messages.list({ to: 'jane@example.com' })
assert.deepEqual(page, { data: [], nextCursor: null })
assert.equal(seen[0].method, 'GET')
assert.equal(seen[0].headers.get('authorization'), 'Bearer mskw_example')
assert.equal(new URL(seen[0].url).searchParams.get('to'), 'jane@example.com')

// An error answer becomes a MailsinkError with the server code and request id.
await assert.rejects(sink.messages.get('msg_missing'), (error) => {
  assert.ok(isMailsinkError(error, 'not_found'))
  assert.equal(error.status, 404)
  assert.equal(error.requestId, 'req_2')
  return true
})

// Admin calls without the admin key fail before any request.
await assert.rejects(sink.admin.workspaces.list(), (error) =>
  isMailsinkError(error, 'unauthorized'),
)

// The scoped copy keeps the other options.
const scoped = sink.with({ key: 'mskw_other' })
await scoped.messages.list()
assert.equal(seen.at(-1).headers.get('authorization'), 'Bearer mskw_other')

// Pure helpers.
const message = {
  subject: 'Your code is 482913',
  html: '<a href="https://app.example.com/verify?token=a&amp;b=1">Verify</a>',
}
assert.equal(extractCode(message), '482913')
assert.deepEqual(extractLinks(message), ['https://app.example.com/verify?token=a&b=1'])
assert.equal(findLink(message, '/verify'), 'https://app.example.com/verify?token=a&b=1')

console.log(`@devitek/mailsink smoke test passed on Node ${process.versions.node}`)
