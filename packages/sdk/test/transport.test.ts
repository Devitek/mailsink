import { afterEach, describe, expect, it, vi } from 'vitest'
import rootPackage from '../../../package.json'
import sdkPackage from '../package.json'
import { createMailsink, isMailsinkError, MailsinkError } from '../src'

type Answer = (request: Request) => Response | Promise<Response>

/** A client whose `fetch` records requests and answers with `answer`. */
function fake(answer: Answer, options: Partial<Parameters<typeof createMailsink>[0]> = {}) {
  const requests: Request[] = []
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    requests.push(request)
    return answer(request)
  }
  const sink = createMailsink({ url: 'https://sink.test/base', key: 'mskw_k', fetch, ...options })
  return { sink, requests }
}

const page = { data: [], nextCursor: null }

describe('transport', () => {
  it('builds URLs under a path prefix, with the key, workspace and extra headers', async () => {
    const { sink, requests } = fake(() => Response.json(page), {
      workspace: 'team',
      headers: { 'x-trace': '1' },
    })
    await sink.messages.list({ to: 'a b', status: ['delivered'] })
    const [request] = requests
    expect(request?.url).toBe('https://sink.test/base/capture/messages?to=a+b&status=delivered')
    expect(request?.headers.get('authorization')).toBe('Bearer mskw_k')
    expect(request?.headers.get('x-mailsink-workspace')).toBe('team')
    expect(request?.headers.get('x-trace')).toBe('1')
  })

  it('throws typed errors from the contract body, the status, or the network', async () => {
    const body = {
      error: { code: 'validation_error', message: 'Bad', details: { in: 'query' } },
      requestId: 'req_1',
    }
    const contract = await fake(() => Response.json(body, { status: 422 }))
      .sink.messages.list()
      .catch((e: unknown) => e)
    expect(contract).toBeInstanceOf(MailsinkError)
    expect(contract).toMatchObject({
      code: 'validation_error',
      status: 422,
      requestId: 'req_1',
      details: { in: 'query' },
    })

    const proxy = await fake(
      () => new Response('<h1>gone</h1>', { status: 404, headers: { 'x-request-id': 'req_2' } }),
    )
      .sink.messages.get('msg_1')
      .catch((e: unknown) => e)
    expect(proxy).toMatchObject({ code: 'not_found', status: 404, requestId: 'req_2' })

    const network = await fake(() => {
      throw new TypeError('fetch failed')
    })
      .sink.overrides.get()
      .catch((e: unknown) => e)
    expect(isMailsinkError(network, 'network_error')).toBe(true)
    expect((network as MailsinkError).status).toBeNull()
  })

  it('refuses calls without the right credential before sending', async () => {
    const { sink, requests } = fake(() => Response.json(page), { key: undefined })
    await expect(sink.messages.list()).rejects.toMatchObject({ code: 'unauthorized' })
    await expect(sink.admin.workspaces.list()).rejects.toMatchObject({ code: 'unauthorized' })
    expect(requests).toEqual([])
  })

  it('validates answers only when asked', async () => {
    const bad = () => Response.json({ data: 'nope' })
    expect(await fake(bad).sink.messages.list()).toEqual({ data: 'nope' })
    await expect(fake(bad, { validate: true }).sink.messages.list()).rejects.toMatchObject({
      code: 'invalid_response',
    })
  })
})

describe('messages.waitFor', () => {
  afterEach(() => vi.useRealTimers())

  it('sends wait=true with since = the call time by default', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-05-01T10:00:00.000Z') })
    const message = { id: 'msg_1' }
    const { sink, requests } = fake((r) =>
      r.url.includes('/capture/messages/msg_1')
        ? Response.json(message)
        : Response.json({ data: [{ id: 'msg_2' }, message], nextCursor: null }),
    )
    expect(await sink.messages.waitFor({ to: 'jane' })).toEqual(message)
    const query = new URL(requests[0]?.url ?? '').searchParams
    expect(Object.fromEntries(query)).toEqual({
      to: 'jane',
      since: '2026-05-01T10:00:00.000Z',
      wait: 'true',
      timeout: '10000',
    })
  })

  it('splits waits longer than 30 s into several long polls', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const timeouts: number[] = []
    const { sink } = fake((r) => {
      const timeout = Number(new URL(r.url).searchParams.get('timeout'))
      timeouts.push(timeout)
      vi.setSystemTime(Date.now() + timeout)
      return Response.json(
        { error: { code: 'wait_timeout', message: 'No match' }, requestId: 'req_9' },
        { status: 408 },
      )
    })
    const error = await sink.messages.waitFor({}, { timeout: 45_000 }).catch((e: unknown) => e)
    expect(timeouts).toEqual([30_000, 15_000])
    expect(error).toMatchObject({ code: 'wait_timeout', status: 408, requestId: 'req_9' })
  })
})

describe('package', () => {
  it('is versioned with the server (D181) and ready for npm', () => {
    expect(sdkPackage.version).toBe(rootPackage.version)
    expect(sdkPackage).toMatchObject({
      name: '@devitek/mailsink',
      license: 'MIT',
      files: ['dist'],
      publishConfig: { access: 'public' },
    })
    expect('private' in sdkPackage).toBe(false)
  })
})
