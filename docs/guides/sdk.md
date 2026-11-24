# TypeScript SDK (`@devitek/mailsink`)

`@devitek/mailsink` is the typed client of every Mailsink HTTP surface a test or a tool
needs: Admin API, Capture API, overrides, suppressions, webhooks, logs and the live
stream. It is the base of the Playwright and Vitest helpers and of the CLI. Install, quick
start and recipes (magic link, one-time code, bounce): the
[package README](../../packages/sdk/README.md). Decisions: D235 to D239.

## Package

- Lives in `packages/sdk`, published as `@devitek/mailsink` (#128 publishes it), with the
  version of the server: the root `package.json` (D181), bumped in
  `packages/sdk/package.json` by release-please (`extra-files`).
- ESM only, plain `fetch`, no Node-only API: Node 20+ and browsers. `src/` is typechecked
  without Node typings (`tsconfig.json`); tests use `tsconfig.test.json`.
- `pnpm --filter @devitek/mailsink build` (tsdown) writes `dist/index.js` and
  `dist/index.d.ts`. The private `@mailsink/contracts` is bundled into both
  (`tsconfig.build.json` lets the declaration build see it); `zod` is the only runtime
  dependency. In the monorepo, `exports` points to `src/index.ts`; `publishConfig.exports`
  points the published package to `dist/`.

## Client

```ts
createMailsink({
  url,          // base URL; a path prefix is kept (https://ci.example.com/mailsink)
  key,          // mskw_ workspace key or msk_ connection key: workspace calls
  adminKey,     // admin calls; workspace calls too, with `workspace`
  workspace,    // id or slug, sent as X-Mailsink-Workspace
  fetch,        // custom fetch (default: globalThis.fetch)
  headers,      // extra headers on every call
  validate,     // parse every answer with its contract (default false)
})
```

`client.with(patch)` returns a client with some options changed, typically
`admin.with({ key: created.workspaceKey })` after creating a workspace. A call without the
credential it needs fails with `unauthorized` before any request.

Types: request bodies are the `z.input` of their contract, answers the `z.output`. List
queries take the output type with every key optional; `since`, `until` and `before` also
take a `Date`, arrays are sent comma-separated. Every type is exported (`MessageDetail`,
`StreamEvent`, `CreateWorkspaceInput`…).

## Namespaces

| Namespace | Calls | Route |
|---|---|---|
| `admin.workspaces` | `create`, `list`, `get`, `update`, `delete`, `rotateKey` | `/admin/workspaces[/:ref[/key/rotate]]` |
| `admin.connections` | `create(ref, input)`, `update(ref, id, patch)`, `delete`, `rotate` | `/admin/workspaces/:ref/connections[/:id[/rotate]]` |
| `admin.templates` | `list(ref)`, `create`, `get(ref, templateId)`, `update`, `delete` | `/admin/workspaces/:ref/templates[/:templateId]` |
| `admin.logs` | `list`, `get` | `/admin/logs/api[/:id]` |
| `messages` | `list`, `get`, `waitFor`, `raw`, `attachment`, `purge`, `triggerEvent`, `seedDemo` | `/capture/messages…`, `/capture/demo` |
| `overrides` | `get`, `activate(config, { connectionId?, ttl? })`, `reset({ connectionId? })`, `with(config, fn, options?)` | `/capture/override[/reset]` |
| `suppressions` | `list`, `delete(email)`, `clear()` | `/capture/suppressions` |
| `webhooks` | `list`, `create`, `get`, `update`, `delete`, `preview`, `test`; `deliveries.list`, `deliveries.get`, `deliveries.replay` | `/capture/webhooks…` |
| `logs` | `api.list`, `api.get`, `smtp.list`, `smtp.get` | `/capture/logs/{api,smtp}[/:id]` |
| `stream` | `subscribe(handler, options?)` | `/capture/stream` |

`ref` is a workspace id or slug. `messages.raw(id)` answers the EML as text;
`messages.attachment(id, attachmentId)` answers `{ filename, contentType, data }`
(`Uint8Array`). `overrides.with` resets the same scope in `finally`, so a failing callback
never leaves an override behind.

## Waiting for a message

`messages.waitFor(filters, { timeout = 10_000, since, signal })` long polls
`GET /capture/messages?wait=true` and resolves the full `MessageDetail` of the earliest
matching message of the page. Filters are those of `messages.list` (`to`, `from`,
`subject`, `tag`, `status`, `connectionId`, `q`…).

- `since` defaults to the time of the call: a message stored before `waitFor` is called is
  not seen. Start the wait before the action and await it after, or take `since` before the
  action with `mailsink.now()`.
- `since` is read on the server clock. Every answer carries a `Date` header (one second
  precision); `mailsink.now()` corrects the client clock by the skew those headers prove,
  and only by it (D261). Before the first answer, or in a browser calling another origin
  (the header is not exposed to cross-origin scripts), it is the client clock: against a
  remote server with a skewed clock, make one call first (any `list`) or pass `since`.
- A `timeout` over 30 s (the server maximum) is split into successive long polls.
- No match: `MailsinkError` `wait_timeout`, its message and `details` carry the filters.

## Errors

`MailsinkError` carries `code`, `status`, `requestId` and `details`. Codes: the server
`ErrorCode` (D40: `unauthorized`, `forbidden`, `validation_error`, `not_found`,
`conflict`, `idempotency_mismatch`, `rate_limited`, `payload_too_large`, `chaos_injected`,
`wait_timeout`, `internal_error`), plus `network_error` (no answer, `status` null) and
`invalid_response` (not JSON, or a failed `validate`). An error answer that is not the
contract body (a proxy page) gets the code of its status. `isMailsinkError(error, code?)`
narrows.

## Stream

```ts
const subscription = mailsink.stream.subscribe(handler, {
  types,        // StreamEventType[]; workspace.deleted always comes
  connectionId, // keep one connection's message and log frames
  lastEventId,  // resume after an evt_ id
  retryMs,      // reconnection delay (default: the server retry, 3 s)
  signal, onOpen, onError,
})
await subscription.ready // first connection open
subscription.lastEventId // last evt_ id received
subscription.close()
await subscription.done
```

The SDK reads the SSE body over `fetch` with its own parser (no `EventSource`, so the
`Authorization` header works in browsers too). The handler gets each `StreamEvent` and its
frame `{ id }` (`null` for derived frames: statuses, logs, deliveries, overrides). When
the connection drops, it reconnects with `Last-Event-ID`; the server replays the frames
with an id missed meanwhile (`message.created`, `message.event`, up to 500). A 400, 401,
403, 404 or 422 stops it (`ready` and `done` reject); a `workspace.deleted` frame ends it;
handler errors go to `onError` and the stream goes on.

## Helpers

- `extractLinks(message)`: every http(s) link, once each, in order: the links the server
  extracted, the `href`s of the HTML body (entities decoded), the URLs of the text body.
- `findLink(message, matcher)`: the first link matching a substring, a `RegExp` or a
  predicate on the parsed `URL`; `null` when none does.
- `extractCode(message, { length = 6, pattern? })`: the first standalone run of `length`
  digits in the subject, the text body, then the visible text of the HTML body (URLs
  skipped); with `pattern`, its first capture group (or whole match). `null` when none.

They accept any object with `subject`, `text`, `html` and `links`, so a `MessageDetail`
fits.

## Tests

`packages/sdk/test` runs the SDK against the real routes of the app: `test/server.ts`
imports every `apps/mailsink/src/routes/{admin,capture,v1}.*.ts` file, derives its path
from the file name and serves the handlers on a loopback port, so the SDK goes through
`fetch`, Node streams and real sockets (the stream test drops them to check the
reconnection). The runtime is the app test runtime on both drivers (`describeDb`); the
recipe suite also runs the delivery simulation worker.
