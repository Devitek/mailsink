# Fidelity analysis of the Resend and Brevo connectors (issue #157)

## 1. Scope and method

- Date: 24/11/2026. Mailsink state: branch `main` at `5c58f27` (0.3 wave, after #152 and #156).
- Rule applied (owner, 24/11): Mailsink must simulate provider behaviour faithfully and
  globally, for any application. What exists at the provider for transactional email should
  exist in its connector.
- Mailsink sources read: `docs/architecture/03-contracts.md` (Resend dialect, Brevo dialect,
  Brevo read routes, Brevo templates, Webhooks, Event mapping, Errors and rate limit headers),
  decision log `docs/architecture/README.md` (D20 to D25, D53, D75, D90 to D93, D120 to D129,
  D135 to D144, D152, D153, D158, D275 to D279), `packages/contracts/src/{resend,brevo,
  brevo-read,webhook,webhook-payloads}.ts`, `packages/core/src/dialects/**`,
  `packages/core/src/webhooks/formatters/{resend,brevo,events-map}.ts`,
  `packages/core/src/ingestion/idempotency.ts`, `apps/mailsink/src/routes/{emails*,v3.smtp.*}.ts`.
- In progress elsewhere (counted as « in progress »): issue #153, owner decision of 24/11 that
  refuses D277: a canonical « invalid address » event (`email.invalid`) emitted as Brevo
  `invalid_email`, and the simulated `failed` status emitted as Brevo `error`.
- Provider sources (official only, fetched on 24/11/2026, Markdown variants):
  - Resend API reference: https://resend.com/docs/api-reference/introduction,
    `/errors`, `/rate-limit`, `/pagination`, `/emails/send-email`, `/emails/send-batch-emails`,
    `/emails/retrieve-email`, `/emails/list-emails`, `/emails/update-email`,
    `/emails/cancel-email`, `/emails/share-email`, `/emails/list-email-attachments`,
    `/emails/retrieve-email-attachment`, `/emails/get-metrics`, `/logs/list-logs`,
    `/suppressions/*`, `/templates/*`, `/webhooks/*` (all under
    https://resend.com/docs/api-reference/).
  - Resend guides: https://resend.com/docs/dashboard/emails/idempotency-keys,
    `/schedule-email`, `/attachments`, `/embed-inline-images`, `/tags`, `/custom-headers`,
    `/send-test-emails`, https://resend.com/docs/dashboard/templates/introduction.
  - Resend webhooks: https://resend.com/docs/webhooks/event-types,
    `/verify-webhooks-requests`, `/retries-and-replays`, `/emails/{sent,delivered,
    delivery-delayed,bounced,complained,opened,clicked,failed,scheduled,suppressed}`,
    `/suppressions/added` (under https://resend.com/docs/webhooks/).
  - Resend Node SDK `resend` 6.39.0 (installed in the repository, `dist/index.mjs`).
  - Brevo API reference: https://developers.brevo.com/reference/send-transac-email,
    `get-transac-emails-list`, `get-transac-email-content`, `get-scheduled-email-by-id`,
    `delete-scheduled-email-by-id`, `delete-an-smtp-transactional-log`,
    `get-email-event-report`, `get-smtp-report`, `get-aggregated-smtp-report`,
    `get-transac-blocked-contacts`, `unblock-or-resubscribe-a-transactional-contact`,
    `get-blocked-domains`, `block-new-domain`, `delete-blocked-domain`, `delete-hardbounces`,
    `get-smtp-templates`, `get-smtp-template`, `create-smtp-template`, `update-smtp-template`,
    `delete-smtp-template`, `send-test-template`, `post-preview-smtp-email-templates`,
    `create-webhook`, `get-webhooks`, `export-webhooks-history`.
  - Brevo guides: https://developers.brevo.com/docs/send-a-transactional-email,
    `/docs/batch-send-transactional-emails`, `/docs/heterogenous-versions-batch-emails`
    (idempotency), `/docs/transactional-webhooks`, `/docs/how-to-use-webhooks`,
    `/docs/secured-webhooks`, `/docs/batch-webhooks`, `/docs/retry-mechanism`,
    `/docs/api-limits`, `/docs/limit-headers`, `/guides/node-js`.
  - Brevo Node SDK `@getbrevo/brevo` 6.2.0 (installed, `dist/cjs`).
- Not checked: provider behaviour that is only observable on the live APIs (exact error
  messages Brevo does not document, unknown-route bodies). Such points are flagged « to verify
  live » and belong to the manual checks issue #107.

Status legend: **covered** (behaves as the provider for what an SDK user observes),
**partial** (exists, with gaps), **missing** (no route or no behaviour), **divergent**
(exists and behaves differently on purpose or by mistake), **in progress** (#153),
**out of scope** (not transactional email, or needs a domain Mailsink does not model).
Priority: **P1** commonly used by transactional apps (a call that works at the provider fails
or misleads on Mailsink), **P2** useful, **P3** rare.

## 2. Coverage matrices

### 2.1 Resend

#### Sending (`POST /emails`)

| # | Feature | Provider behaviour (source) | Mailsink today | Status | Prio | Notes |
|---|---|---|---|---|---|---|
| R1 | `from`, `to`, `subject`, `cc`, `bcc`, `reply_to`, `html`, `text` | `from` `Name <email>`, `to` string or array, max 50 (api-reference/emails/send-email) | `ResendSendRequest` (`packages/contracts/src/resend.ts`), route `apps/mailsink/src/routes/emails.ts`; `replyTo` camelCase also accepted | covered | P1 | |
| R2 | Plain text generated from `html` | « If not provided, the HTML will be used to generate a plain text version. You can opt out … by setting value to an empty string » (send-email) | Not generated (D123); `GET /emails/:id` answers `text: null` | divergent | P2 | Affects tests asserting on the text part |
| R3 | `headers` | Custom headers object (send-email, dashboard/emails/custom-headers) | `z.record(string, string)`, stored with the message | covered | P1 | |
| R4 | `tags` | `name`/`value` ASCII letters, digits, `_`, `-`, max 256 chars; « up to 75 tags per email » (dashboard/emails/tags) | Charset and length enforced; no 75 cap | partial | P3 | |
| R5 | `topic_id` | Opt-in/opt-out per contact topic; opted-out recipient « marked as failed » (send-email) | Accepted, ignored | partial | P3 | Needs contacts/topics, out of scope otherwise |
| R6 | `template { id, variables }` | Published template by id or alias; `html`/`text`/`react` forbidden with it; `from`/`subject`/`reply_to` override template defaults; a missing variable without fallback is a validation error; keys max 50 chars, reserved `FIRST_NAME`, `LAST_NAME`, `EMAIL`, `UNSUBSCRIBE_URL`; string values max 2000 chars (send-email) | Refused `400 validation_error` (D123) | divergent | P1 | An app using hosted templates cannot send at all |
| R7 | `react` | Node SDK renders it to `html` before the call (SDK `Emails.create`) | Transparent (SDK side) | covered | P2 | |
| R8 | `scheduled_at` | ISO 8601 or natural language (`in 1 min`), up to 30 days ahead (dashboard/emails/schedule-email) | Accepted as any string, not honoured, `scheduled_at: null` on read (D123) | divergent | P2 | See R22 to R24 |
| R9 | Attachments `content` (base64), `filename`, `content_type` | `content_type` derived from `filename` when absent (send-email) | Stored (`ResendAttachment`) | covered | P1 | |
| R10 | Attachments `path` (remote URL) | Resend fetches the URL (dashboard/emails/attachments) | Refused `422 invalid_attachment` (D123) | divergent | P1 | Invoices on object storage are a common pattern |
| R11 | Inline images `content_id` | `cid:` reference, content id « less than 128 characters » (dashboard/emails/embed-inline-images) | Stored as inline part; 128 cap not enforced | covered | P2 | |
| R12 | Size limit | « Emails can be no larger than 40MB (including attachments after Base64 encoding) »; some file types unsupported (dashboard/emails/attachments) | `MAILSINK_MAX_MESSAGE_BYTES`, 25 MiB by default, `413 validation_error`; no file type list | partial | P2 | Default lower than Resend |
| R13 | Validation errors | `422 missing_required_field`, `400 validation_error`, `422 invalid_attachment`, `422 invalid_parameter` (api-reference/errors) | Same names and statuses (D122, `http/dialects/resend/errors.ts`) | covered | P1 | |

#### Batch and idempotency

| # | Feature | Provider behaviour (source) | Mailsink today | Status | Prio | Notes |
|---|---|---|---|---|---|---|
| R14 | `POST /emails/batch` | Up to 100 emails, `data` in request order, no `attachments` (send-batch-emails) | 1 to 100, no attachments, order kept (D121) | covered | P1 | |
| R15 | `x-batch-validation` | SDK sends `strict` by default (SDK `batch.send`) | `strict` / `permissive` with `errors[]` (D121) | covered | P1 | |
| R16 | `template` and `scheduled_at` per batch email | Both documented on the batch body (send-batch-emails, schedule-email « Schedule emails on the POST /emails/batch endpoint ») | Template refused, schedule ignored | divergent | P2 | Follows R6 and R8 |
| R17 | `Idempotency-Key` | 24 h, 1 to 256 chars, `400 invalid_idempotency_key`, `409 invalid_idempotent_request` (dashboard/emails/idempotency-keys) | Same (D53, D122), workspace scope | covered | P1 | |
| R18 | Concurrent requests with the same key | `409 concurrent_idempotent_requests` (idempotency-keys) | The loser of the race replays the winner (`ingestion/idempotency.ts`) | divergent | P3 | Name already in `ResendErrorName` |
| R19 | `Resend-Idempotency-Key` SMTP header | Idempotency over SMTP (idempotency-keys) | Not read by the SMTP dialect | missing | P3 | area:smtp |

#### Retrieval, scheduling, lists

| # | Feature | Provider behaviour (source) | Mailsink today | Status | Prio | Notes |
|---|---|---|---|---|---|---|
| R20 | `GET /emails/:id` | `object`, `id`, `message_id`, `to`, `from`, `created_at`, `subject`, `html`, `text`, `bcc`, `cc`, `reply_to`, `last_event`, `scheduled_at`, `tags` (retrieve-email) | All fields (`core/dialects/resend-read.ts`); `scheduled_at` always null, `text` never generated, `last_event` never `scheduled` / `canceled` | partial | P1 | Core fields right; gaps come from R2 and R8 |
| R21 | `GET /emails` (list) | Cursor `limit` (1..100, default 20), `after` / `before`, `{ object: 'list', has_more, data }` (list-emails, pagination) | No route | missing | P2 | SDK `emails.list()` |
| R22 | `PATCH /emails/:id` (reschedule) | Body `{ scheduled_at }`, answers `{ object: 'email', id }` (update-email) | No route | missing | P2 | SDK `emails.update()` |
| R23 | `POST /emails/:id/cancel` | Answers `{ object: 'email', id }`; a canceled email cannot be rescheduled (cancel-email, schedule-email) | No route | missing | P2 | SDK `emails.cancel()` |
| R24 | Scheduled delivery | Email held until `scheduled_at`, `email.scheduled` webhook (schedule-email, webhooks/emails/scheduled) | Delivered at once | divergent | P2 | D123 |
| R25 | `GET /emails/:email_id/attachments[/:id]` | List and get with signed `download_url`, `expires_at`, `content_disposition`, `content_id` (list-email-attachments, retrieve-email-attachment) | No route (capture API has its own) | missing | P3 | |
| R26 | `POST /emails/:id/share` | Shareable dashboard link, max 48 h (share-email) | None | out of scope | P3 | Points to the hosted dashboard |
| R27 | `GET /emails/metrics` | Totals and dimensions (`period`, `domain`, `email`), metrics `sent`, `delivered`, `bounced_*`, rates… (get-metrics) | None | missing | P3 | |
| R28 | `GET /logs`, `GET /logs/:id` | API request logs with request and response bodies (logs/list-logs, retrieve-log) | Own request log (`/capture/logs/api`, D145+) in another shape | missing | P3 | |

#### Suppressions and test addresses

| # | Feature | Provider behaviour (source) | Mailsink today | Status | Prio | Notes |
|---|---|---|---|---|---|---|
| R29 | Suppressions API | `POST /suppressions` `{ email }`, `GET /suppressions` (cursor, `origin` filter `bounce`/`complaint`/`manual`), `GET` and `DELETE /suppressions/:id_or_email`, batch add/remove; items `{ id, email, origin, source_id, created_at }` (api-reference/suppressions/*) | Workspace suppression list exists (D75) but only through `/capture/suppressions` | missing | P2 | SDK `suppressions.*` |
| R30 | Test addresses `@resend.dev` | `delivered@`, `bounced@` (550 5.1.1), `complained@`, `suppressed@`, `+label` except `suppressed` (dashboard/emails/send-test-emails) | Not recognised; recipient rules can simulate them manually | missing | P2 | Apps often hard-code these in tests |

#### Templates

| # | Feature | Provider behaviour (source) | Mailsink today | Status | Prio | Notes |
|---|---|---|---|---|---|---|
| R31 | Templates API | `POST/GET/PATCH/DELETE /templates`, `POST /templates/:id/publish`, duplicate; `alias`, `from`, `subject`, `text`, up to 50 `variables` with `type` and `fallback_value`, `{{{VAR}}}` syntax, draft vs published (templates/create-template, publish-template) | Templates exist only as Brevo-shaped Admin API rows with numeric ids (D128) | missing | P2 | Prerequisite of R6 |

#### Webhooks

| # | Feature | Provider behaviour (source) | Mailsink today | Status | Prio | Notes |
|---|---|---|---|---|---|---|
| R32 | `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked`, `email.failed` | Payload `{ type, created_at, data }` (webhooks/event-types and event pages) | Emitted (`formatters/resend.ts`, events-map) | covered | P1 | |
| R33 | `email.suppressed` | Documented event with `data.suppressed { message, type: 'OnAccountSuppressionList' }` (webhooks/emails/suppressed) | Not emitted (D22, D153 say Resend has no such event) | divergent | P2 | The decision rests on an outdated fact |
| R34 | `email.scheduled` | Fires when an email is scheduled (webhooks/emails/scheduled) | Not emitted; unknown subscription name (422) | missing | P2 | Depends on R24 |
| R35 | `email.received` | Inbound email (webhooks/emails/received) | None | out of scope | P3 | Receiving |
| R36 | `suppression.added`, `suppression.removed` | List changes with `origin`, `source_id` (webhooks/suppressions/added) | None | missing | P3 | |
| R37 | `domain.*`, `contact.*`, `topic.*`, `inbox.*` | (event-types) | None | out of scope | P3 | |
| R38 | Payload fields | `data.message_id` (absent on `scheduled`, `failed`, `suppressed`), `template_id`, `broadcast_id`, `tags` as object, `bounce { diagnosticCode[], message, subType, type }`, `click { ipAddress, link, timestamp, userAgent }`, `failed { reason }` (webhooks/emails/bounced and siblings) | `email_id`, `from`, `to`, `subject`, `created_at`, `tags`, `bounce` (`subType: 'General'`), `click`, `failed`; no `message_id`, `template_id`, `diagnosticCode` | partial | P2 | `message_id` is the usual join key with the send log |
| R39 | Signature | Svix: `svix-id`, `svix-timestamp`, `svix-signature`, verified by `resend.webhooks.verify` (verify-webhooks-requests) | Same scheme (D24); verified with the `svix` package in tests | covered | P1 | |
| R40 | `svix-id` format | `msg_…` Svix message ids (webhooks/replay-event example) | `whd_…` delivery id | divergent | P3 | Harmless unless a receiver validates the prefix |
| R41 | Retries | Immediately, 5 s, 5 min, 30 min, 2 h, 5 h, 10 h, 10 h (webhooks/retries-and-replays) | 8 attempts, `min(2^(n-1)·5 s, 1 h) ± 20 %` (D138) | divergent | P3 | |
| R42 | Endpoint auto-disable | A failing endpoint is disabled and the team notified (retries-and-replays) | Never disabled automatically | missing | P3 | |
| R43 | Manual replay | Replay `failed` or `succeeded` messages (retries-and-replays, webhooks/replay-event) | Replay `exact` or `resign` (D24, D139) | covered | P2 | `exact` is a Mailsink extension |
| R44 | Ordering | Not guaranteed (Svix); inbox events note retries keep `svix-id` (event-types) | No ordering guarantee, one job per attempt | covered | P3 | |
| R45 | Webhooks management API | `POST/GET/PATCH/DELETE /webhooks`, rotate secret, list events, get event, list attempts, replay (api-reference/webhooks/*) | Capture API only (`/capture/webhooks`, Mailsink shape) | missing | P3 | |

#### Limits, auth, errors, headers, SDK

| # | Feature | Provider behaviour (source) | Mailsink today | Status | Prio | Notes |
|---|---|---|---|---|---|---|
| R46 | Rate limit | Default 10 req/s per team, headers `ratelimit-limit`, `ratelimit-remaining`, `ratelimit-reset`, `retry-after` on every response, `429 rate_limit_exceeded` (api-reference/rate-limit) | Token bucket per connection when a limit is configured; headers only then (D90, D91, D122) | partial | P3 | No default limit; workspace limit not shared |
| R47 | Quotas | `x-resend-daily-quota`, `x-resend-monthly-quota`, `429 daily_quota_exceeded` / `monthly_quota_exceeded` (rate-limit) | None | missing | P3 | |
| R48 | Missing / invalid key | `401 missing_api_key`; invalid key `401 validation_error` on sending, `400` elsewhere (errors) | Same (D158) | covered | P1 | |
| R49 | Key permissions | Sending-only key on another endpoint: `401 restricted_api_key` « This API key is restricted to only send emails. »; inactive key `403 restricted_api_key` (errors) | No permission levels; key of another connection kind `403 restricted_api_key` (D122) | partial | P3 | |
| R50 | `User-Agent` required | Missing header: 403 (error code 1010) (api-reference/introduction) | Not required | divergent | P3 | Proposal: do not emulate (SDKs always send it) |
| R51 | Domain checks | `403 validation_error` for an unverified domain or the testing domain (errors) | No domain model | out of scope | P3 | Domains are out of scope of this analysis |
| R52 | Unknown route / method | `404 not_found` « The requested endpoint does not exist. », `405 method_not_allowed` (errors) | Not specified for the Resend paths (to verify live) | missing | P3 | SDK maps a non-JSON body to `application_error` |
| R53 | 5xx bodies | `500 application_error`, `503 service_unavailable` (errors) | Chaos and internal errors mapped to them (D122) | covered | P2 | |
| R54 | SDK base URL and transport | `baseUrl` option or `RESEND_BASE_URL`, `User-Agent` `resend-node:<v>`, no automatic retry, errors returned as `{ data, error, headers }` (SDK `dist/index.mjs`) | Contract tests run SDK 6.39 against Mailsink (D124) | covered | P1 | |
| R55 | Other Resend products | Domains, API keys, audiences/segments, contacts, contact properties, broadcasts, topics, automations, events, inboxes, receiving, OAuth (llms.txt index) | None | out of scope | P3 | Marketing, account or inbound |

### 2.2 Brevo

#### Sending (`POST /v3/smtp/email`)

| # | Feature | Provider behaviour (source) | Mailsink today | Status | Prio | Notes |
|---|---|---|---|---|---|---|
| B1 | `sender`, `to`, `cc`, `bcc`, `replyTo`, `subject`, `htmlContent`, `textContent` | `sender` and `subject` required without `templateId`; names max 70 (reference/send-transac-email) | `BrevoSendRequest` (`packages/contracts/src/brevo.ts`), route `v3.smtp.email.ts` | covered | P1 | |
| B2 | Recipient caps | 99 per version, 2000 per request (send-transac-email) | Same | covered | P1 | |
| B3 | `sender.id` | Sender id instead of email (dedicated IP) (send-transac-email) | Refused (D125) | divergent | P3 | |
| B4 | `templateId` + `params` | Template sender and subject apply unless overridden; `htmlContent`/`textContent` ignored with a template (send-transac-email) | Same; unknown id `400 invalid_parameter` | covered | P1 | |
| B5 | Template language | « New Template Language »: `{{ params.x }}`, `{{ contact.X }}`, plus conditions, loops and filters (send-a-transactional-email, batch-send) | Subset: `params`, `contact.EMAIL`, filters `default`, `upper`, `lower`, `safe`; blocks left verbatim (D126) | partial | P2 | Templates with `{% if %}` render wrong |
| B6 | `contact.*` attributes | Read from the contact database, cannot be overridden by `params` (batch-send) | Empty except `contact.EMAIL` | partial | P3 | Needs a contact model |
| B7 | `messageVersions` | Overrides `to`, `cc`, `bcc`, `replyTo`, `subject`, `params`, `htmlContent`, `textContent`; per-version `templateId` only with a global one; per-version html/text only if one is global; max 1000 versions (send-transac-email, batch-send) | Overrides supported; per-version `templateId` silently dropped; the « only if global » rule not enforced | partial | P1 | Core use covered |
| B8 | `params` size | 100 KB per object, 1000 KB cumulative (batch-send) | Not enforced | missing | P3 | |
| B9 | `headers` | Title-Case conversion, standard headers not supported, `sender.ip`, `X-Mailin-custom`, `idempotencyKey` (send-transac-email) | Values stringified and kept; `X-Mailin-custom` echoed in webhooks; no Title-Case, no refusal of standard headers | partial | P3 | |
| B10 | Attachments `content` + `name` | `name` required with `content`; extension whitelist (send-transac-email) | Stored; no extension check | partial | P3 | |
| B11 | Attachments `url` | Absolute URL fetched by Brevo (send-transac-email) | Accepted, never fetched, listed in `metadata.brevo.attachmentUrls` (D125) | partial | P2 | Captured message lacks the file |
| B12 | `tags` | Array of strings (send-transac-email) | Max 50 tags of 256 chars (Mailsink bound, not Brevo's) | divergent | P3 | |
| B13 | `scheduledAt` | UTC date-time, may be delayed up to 5 min; answer **202** « scheduled successfully » (send-transac-email) | Stored in metadata, delivered at once, answers 201 (D125) | divergent | P2 | |
| B14 | `batchId` | UUIDv4, generated when omitted (send-transac-email) | Stored when given, never generated | partial | P2 | Needed by B21/B22 |
| B15 | `contactPixelTrackingConsent`, `removeTrackingPixel` | Booleans per recipient, other values rejected (send-transac-email) | Unknown keys dropped | partial | P3 | No tracking pixel in Mailsink |
| B16 | Response | 201 `{ messageId }` or `{ messageIds }` (send-transac-email, batch-send) | Same, ids `<msg_…@mailsink>` | covered | P1 | |
| B17 | Error body | `{ code, message }`, 400 with `invalid_parameter`, `missing_parameter`, `out_of_range`, `duplicate_parameter`… (send-transac-email « Errors ») | Same codes (D127) | covered | P1 | Messages not documented by Brevo (to verify live) |
| B18 | Idempotency | `headers.idempotencyKey` UUID, TTL 30 min, reuse `duplicate_parameter`, one key per request including versions (docs/heterogenous-versions-batch-emails) | Same (D279) | covered | P1 | |
| B19 | Auth | `api-key` header or OAuth bearer (send-transac-email « Authentication ») | `api-key` or bearer `msk_` of a `brevo` connection, other kind 403 `permission_denied` | covered | P1 | 401 message to verify live |

#### Read and management routes

| # | Feature | Provider behaviour (source) | Mailsink today | Status | Prio | Notes |
|---|---|---|---|---|---|---|
| B20 | `GET /v3/smtp/emails` | Filters `email` / `templateId` / `messageId` (one required), dates max one month, 30 days default, `limit` default 500, `{ count, transactionalEmails }` (get-transac-emails-list) | Implemented (D275), calling connection only | covered | P1 | UTC days instead of the account timezone tracked in #153 |
| B21 | `GET /v3/smtp/emails/{uuid}` | `{ date, email, events[{ name, time }], subject, attachmentCount, body, templateId }` (get-transac-email-content) | None (the `uuid` returned by B20 leads nowhere) | missing | P2 | SDK `getTransacEmailContent` |
| B22 | `GET /v3/smtp/emailStatus/{identifier}` | Scheduled batch by `batchId` or message by `<messageId>`, `status` `processed`/`inProgress`/`queued` (get-scheduled-email-by-id) | None | missing | P2 | Depends on B13 |
| B23 | `DELETE /v3/smtp/email/{identifier}` | Delete a scheduled batch or message, 204 (delete-scheduled-email-by-id) | None | missing | P2 | Depends on B13 |
| B24 | `DELETE /v3/smtp/log/{identifier}` | Delete logs by message id or email, optional `from_date`/`to_date`, 204 (delete-an-smtp-transactional-log) | None | missing | P3 | |
| B25 | `GET /v3/smtp/blockedContacts` | Offset list, reasons `hardBounce`, `contactFlaggedAsSpam`, `adminBlocked`, `unsubscribedVia*` (get-transac-blocked-contacts) | Implemented on the workspace list (D276); unsubscription codes never produced | covered | P2 | |
| B26 | `DELETE /v3/smtp/blockedContacts/{email}` | 204, 404 when not listed (unblock-or-resubscribe) | Implemented (D276) | covered | P2 | |
| B27 | `POST /v3/smtp/deleteHardbounces` | Delete hard bounces by date range or email (reference/delete-hardbounces; SDK `deleteHardbounces`) | None | missing | P3 | |
| B28 | Blocked domains | `GET/POST /v3/smtp/blockedDomains`, `DELETE …/{domain}`; sends to a blocked domain are blocked (get-blocked-domains, block-new-domain, delete-blocked-domain) | None | missing | P3 | |
| B29 | `GET /v3/smtp/statistics/events` | Unaggregated events, `days` max 90, filters `email`, `event` (`bounces`, `hardBounces`, `softBounces`, `delivered`, `spam`, `requests`, `opened`, `clicks`, `invalid`, `deferred`, `blocked`, `unsubscribed`, `error`, `loadedByProxy`), `tags`, `messageId`, `templateId`, `limit` default 2500 (get-email-event-report) | None | missing | P2 | Common in test assertions and back-office sync |
| B30 | `GET /v3/smtp/statistics/reports` | Per day, 10 days default, 30 max (get-smtp-report) | None | missing | P3 | |
| B31 | `GET /v3/smtp/statistics/aggregatedReport` | Totals, 90 days default (get-aggregated-smtp-report) | None | missing | P3 | |
| B32 | Templates API | `GET /v3/smtp/templates` (offset, `templateStatus`), `GET/PUT/DELETE /v3/smtp/templates/{id}` (id or custom id string), `POST` (`templateName`, `sender`, `subject`, `htmlContent` > 10 chars or `htmlUrl`, `isActive` false by default), delete only when inactive (405) (get-smtp-templates … delete-smtp-template) | Admin API `/admin/workspaces/:id/templates` with its own shape (D128) | divergent | P2 | Apps that create templates at deploy time cannot |
| B33 | `POST /v3/smtp/templates/{id}/sendTest`, `POST /v3/smtp/template/preview` | Test send to a test list (max 50 a day), rendered preview (send-test-template, post-preview-smtp-email-templates) | None | missing | P3 | |

#### Webhooks

| # | Feature | Provider behaviour (source) | Mailsink today | Status | Prio | Notes |
|---|---|---|---|---|---|---|
| B34 | `request`, `delivered`, `soft_bounce`, `hard_bounce`, `spam`, `opened`, `click`, `deferred`, `blocked` | (docs/transactional-webhooks) | Emitted (`formatters/brevo.ts`), subscription names and payload names both mapped | covered | P1 | |
| B35 | `invalid_email` | Invalid address (transactional-webhooks) | Mapped from the simulated `failed` (D277, refused by the owner) | in progress | P1 | #153: canonical `email.invalid` |
| B36 | `error` | Send error (transactional-webhooks) | Not emitted | in progress | P2 | #153: `failed` emitted as `error` |
| B37 | `unique_opened` (subscription `uniqueOpened`) | First opening (transactional-webhooks, create-webhook) | Not emitted, unknown subscription name | missing | P2 | |
| B38 | `unsubscribed` | Unsubscription with `user_agent`, `device_used`, `sending_ip` (transactional-webhooks) | None | missing | P3 | |
| B39 | `proxy_open`, `unique_proxy_open` | Opens through a privacy proxy (transactional-webhooks) | None | missing | P3 | |
| B40 | Payload fields | `sending_ip`, `user_agent` and `device_used` (opens, clicks), `contact_id` (0 when unknown), `mirror_link`, `source` (`automation`/`API`/`SMTP`), `step_id`/`workflow_id` (automation), `tags`, `template_id`, `X-Mailin-custom` (transactional-webhooks) | `event`, `email`, `id`, `date`, `ts`, `ts_event`, `ts_epoch`, `message-id`, `subject`, `tag`, `tags`, `template_id`, `X-Mailin-custom`, `link`, `reason`, `source` | partial | P2 | `user_agent` matters for open/click handlers |
| B41 | Timestamps | `ts_epoch` = ms when the message was sent (event time for clicks); `date` in CET/CEST per the page note, « your timezone » per the tables (transactional-webhooks) | `ts`, `ts_event`, `ts_epoch` all from the event time; `date` in the workspace timezone, UTC by default (D23) | divergent | P3 | |
| B42 | Receiver auth | No signature; bearer token, basic auth in the URL, custom headers, IP allow-list (docs/secured-webhooks) | Bearer, basic (URL credentials moved to `brevoAuth`, D278), custom headers, no signature (D23) | covered | P1 | IP allow-list not applicable |
| B43 | Retries | 4 retries after 10 min, 1 h, 2 h, 8 h; `4xx` except `429` and any `5xx` stop retries; an unresponsive server pauses deliveries 10 min (docs/retry-mechanism) | 8 attempts, exponential from 5 s, every failure retried (D138) | divergent | P2 | A receiver answering 500 is retried by Mailsink, not by Brevo |
| B44 | Batched webhooks | `batched: true`: 5-minute windows, up to 500 events per call (docs/batch-webhooks) | None | missing | P3 | |
| B45 | Webhooks management API | `POST/GET/PUT/DELETE /v3/webhooks`, `type`, `channel`, `auth`, `headers`, `batched`; 40 webhooks max; export history (create-webhook, how-to-use-webhooks, export-webhooks-history) | Capture API only | missing | P3 | |

#### Limits, errors, SDK

| # | Feature | Provider behaviour (source) | Mailsink today | Status | Prio | Notes |
|---|---|---|---|---|---|---|
| B46 | Rate limits | Per route: send and blockedContacts 1000 RPS, `GET /v3/smtp/emails` 2 RPS, other `/v3/smtp/*` 300 RPH (general tier); `429` (docs/api-limits) | One bucket per connection, only when configured (D90) | partial | P3 | |
| B47 | Rate limit headers | `x-sib-ratelimit-limit`, `-remaining`, `-reset` on all rate-limited endpoints (docs/limit-headers) | Sent, copies of `X-RateLimit-*`, only when a limit is configured (D127, D91) | partial | P3 | |
| B48 | `429` body | Status documented, code not documented (api-limits) | `too_many_requests` (D127) | covered | P2 | Keep, flagged as an assumption |
| B49 | SDK transport | `baseUrl`, `api-key` header, 60 s timeout, 2 automatic retries on 408, 429, 5xx honouring `Retry-After` (guides/node-js; SDK `core/fetcher/requestWithRetries.js`, which reads `X-RateLimit-Reset` as an epoch) | Contract tests run SDK 6.2 (`sdk.contract.test.ts`, `sdk-read.contract.test.ts`); `X-RateLimit-Reset` is relative seconds (D91) | covered | P1 | Chaos tests must pass `maxRetries: 0`; `Retry-After` is always sent on Mailsink 429 so the epoch reading is never reached for 429 |
| B50 | SDK error classes | `transactionalEmails` methods type only 400 and 404 (SDK `Client.js`) | Same statuses | covered | P2 | |
| B51 | Other Brevo products | Campaigns, contacts, senders, domains, SMS, WhatsApp, inbound parsing, accounts, e-commerce (llms.txt index) | None | out of scope | P3 | |

### 2.3 Counts per status

| Status | Resend | Brevo |
|---|---|---|
| covered | 16 | 15 |
| partial | 7 | 11 |
| missing | 16 | 16 |
| divergent | 11 | 6 |
| in progress | 0 | 2 |
| out of scope | 5 | 1 |
| **total rows** | 55 | 51 |

(Rows are features as listed above; « out of scope » rows group several provider products.)

P1 gaps (not covered, P1):

- Resend R6: hosted templates (`template { id, variables }`) refused.
- Resend R10: attachment `path` URLs refused.
- Resend R20: `GET /emails/:id` partial (no `scheduled_at`, generated `text`, `scheduled` /
  `canceled` states), a consequence of R2, R8, R24.
- Brevo B7: per-version `templateId` dropped (core `messageVersions` use is covered).
- Brevo B35: `invalid_email` semantics, in progress in #153.

## 3. Prioritised gaps grouped into work items

Each work item is tracked as a sub-issue of the epic [#159](https://github.com/Devitek/mailsink/issues/159) (« Fidélité des connecteurs Resend et Brevo »); the checkboxes below are the initial scope, the issues are the living reference.

Proposed parent: an epic « Fidélité des connecteurs Resend et Brevo » (`epic`,
`area:ingestion`, `area:webhooks`). Each item below is one issue (`type:feature` unless stated,
`follow-up` citing #157).

### P1

**[W1](https://github.com/Devitek/mailsink/issues/160). Modèles hébergés Resend : stockage, API `/templates` et envoi avec `template`** (L, P1,
`area:ingestion`, `area:db`)
- [ ] Modèle de template Resend (id UUID, `alias`, `from`, `subject`, `reply_to`, `html`, `text`, variables typées avec `fallback_value`, brouillon et version publiée), à côté des templates Brevo à id numérique (décision de schéma à prendre)
- [ ] Routes `POST/GET/PATCH/DELETE /templates`, `POST /templates/:id/publish`, duplication, pagination par curseur
- [ ] `POST /emails` et `/emails/batch` avec `template { id | alias, variables }` : `html`/`text` interdits, `from`/`subject`/`reply_to` du payload prioritaires, variable manquante sans repli = erreur de validation, contraintes des clés (50 caractères, noms réservés) et des valeurs (2000 caractères)
- [ ] Rendu `{{{VAR}}}` et `template_id` dans les payloads webhook Resend
- [ ] Amender D123 ; tests de contrat avec le SDK `resend` (`resend.templates.*`)

**[W2](https://github.com/Devitek/mailsink/issues/161). Pièces jointes distantes : `path` (Resend) et `url` (Brevo) récupérées** (M, P1,
`area:ingestion`, `security`)
- [ ] Téléchargement du fichier à l'ingestion, derrière le garde d'URL (`url-guard`, D150, D155) et un délai maximal
- [ ] Taille maximale alignée sur Resend (40 Mo après base64) et réglage `MAILSINK_MAX_MESSAGE_BYTES` documenté
- [ ] `content_type` déduit du nom de fichier (Resend) ; `content_id` inline avec URL distante
- [ ] Erreurs au format de chaque dialecte quand la récupération échoue (à vérifier en réel, #107)
- [ ] Option de désactivation (environnement isolé) ; amender D123 et D125

**[W3](https://github.com/Devitek/mailsink/issues/162). Brevo : `templateId` par version de `messageVersions`** (S, P1, `area:ingestion`)
- [ ] `templateId` accepté par version quand un `templateId` global existe, sinon 400
- [ ] `htmlContent`/`textContent` par version seulement si l'un d'eux est global (règle Brevo)
- [ ] Tests de contrat SDK

(B35 and B36 stay in #153.)

### P2

**[W4](https://github.com/Devitek/mailsink/issues/163). Envois planifiés réels pour Resend et Brevo** (L, P2, `area:ingestion`, `area:capture`,
`area:db`)
- [ ] Statut « planifié » d'un message, simulation et webhooks différés jusqu'à l'échéance (job)
- [ ] Resend : `scheduled_at` ISO ou langage naturel, 30 jours maximum, `last_event` `scheduled` puis `canceled`, `scheduled_at` lu par `GET /emails/:id`, événement `email.scheduled`
- [ ] Resend : `PATCH /emails/:id` (replanification) et `POST /emails/:id/cancel`, une annulation définitive
- [ ] Brevo : réponse 202, `batchId` généré s'il est absent, `GET /v3/smtp/emailStatus/{identifier}` (statuts `queued`, `inProgress`, `processed`), `DELETE /v3/smtp/email/{identifier}`
- [ ] Interface et MCP : voir, avancer ou annuler un envoi planifié
- [ ] Amender D123 et D125

**[W5](https://github.com/Devitek/mailsink/issues/164). Webhooks Resend : `email.suppressed`, `email.scheduled` et champs manquants** (M, P2,
`area:webhooks`)
- [ ] Émettre `email.suppressed` (`data.suppressed { message, type }`) et réviser D22 et D153
- [ ] `data.message_id` (absent sur `scheduled`, `failed`, `suppressed`), `data.template_id`, `bounce.diagnosticCode`, sous-types de bounce réalistes (`Suppressed`, `MessageRejected`…)
- [ ] Noms d'abonnement `email.scheduled` et `email.suppressed` acceptés
- [ ] Préfixe `msg_` pour `svix-id` (à décider)

**[W6](https://github.com/Devitek/mailsink/issues/165). Webhooks Brevo : `unique_opened`, champs d'ouverture et de clic, horodatages** (M, P2,
`area:webhooks`, `area:simulation`)
- [ ] Événement `unique_opened` (abonnement `uniqueOpened`) à la première ouverture, `opened` à chaque ouverture (ouvertures multiples simulées, D143 à étendre)
- [ ] Champs `user_agent`, `device_used`, `sending_ip`, `contact_id` (0), `mirror_link` (lien vers l'interface Mailsink)
- [ ] `ts_epoch` = date d'envoi sauf pour `click` ; fuseau par défaut de `date` (CET/CEST d'après Brevo) à trancher (D23)
- [ ] `unsubscribed`, `proxy_open`, `unique_proxy_open` : décider de leur simulation (P3)

**[W7](https://github.com/Devitek/mailsink/issues/166). Réessais des webhooks fidèles à chaque format** (M, P2, `area:webhooks`)
- [ ] Format Resend : calendrier immédiat, 5 s, 5 min, 30 min, 2 h, 5 h, 10 h, 10 h
- [ ] Format Brevo : 4 réessais à 10 min, 1 h, 2 h, 8 h ; arrêt sur `4xx` (sauf `429`) et sur `5xx`
- [ ] Format unifié : garder D138
- [ ] Mode accéléré pour les tests (facteur d'échelle du calendrier) ; amender D138
- [ ] Désactivation automatique d'un endpoint Resend en échec durable (P3)

**[W8](https://github.com/Devitek/mailsink/issues/167). Routes de lecture Resend : liste des emails, pièces jointes et texte brut** (M, P2,
`area:ingestion`)
- [ ] `GET /emails` (curseur `limit`/`after`/`before`, `{ object, has_more, data }`)
- [ ] `GET /emails/:email_id/attachments` et `/:id` avec une `download_url` signée et `expires_at`
- [ ] Texte brut généré depuis `html` quand `text` est absent, `text: ""` pour s'en dispenser ; amender D123

**[W9](https://github.com/Devitek/mailsink/issues/168). Suppressions Resend et adresses de test `@resend.dev`** (M, P2, `area:ingestion`,
`area:simulation`)
- [ ] `POST/GET/DELETE /suppressions[/:id_or_email]`, filtre `origin`, ajouts et retraits par lot, sur la liste du workspace (D75)
- [ ] `delivered@`, `bounced@` (550 5.1.1), `complained@`, `suppressed@resend.dev`, libellés `+label`, comme règles intégrées du dialecte Resend
- [ ] Webhooks `suppression.added` / `suppression.removed` (P3)

**[W10](https://github.com/Devitek/mailsink/issues/169). Brevo : contenu d'un envoi et journal des événements** (M, P2, `area:ingestion`)
- [ ] `GET /v3/smtp/emails/{uuid}` (`body`, `events[{ name, time }]`, `attachmentCount`, `templateId`)
- [ ] `GET /v3/smtp/statistics/events` (filtres, `days` ≤ 90, `limit` 2500, noms d'événements Brevo)
- [ ] `GET /v3/smtp/statistics/reports` et `aggregatedReport` (P3)

**[W11](https://github.com/Devitek/mailsink/issues/170). API des templates Brevo `/v3/smtp/templates`** (M, P2, `area:ingestion`)
- [ ] `GET` (liste par offset, `templateStatus`), `GET/PUT/DELETE {templateId}` (id numérique ou id personnalisé), `POST` (`templateName`, `sender`, `htmlContent` > 10 caractères, `isActive` faux par défaut)
- [ ] Suppression refusée (405) pour un template actif ; envoi avec un template inactif (comportement à vérifier en réel)
- [ ] `sendTest` et `POST /v3/smtp/template/preview` (P3)
- [ ] Même table que l'Admin API (D128), qui reste

**[W12](https://github.com/Devitek/mailsink/issues/171). Langage de template Brevo complet** (M, P2, `area:ingestion`)
- [ ] Conditions `{% if %}`, boucles `{% for %}`, filtres documentés par Brevo, avec le même rendu sûr (D126)
- [ ] Attributs `contact.*` : source à décider (paramètres de workspace ou table de contacts de test)

### P3

**[W13](https://github.com/Devitek/mailsink/issues/172). Brevo : domaines bloqués, hard bounces et logs** (M, P3, `area:ingestion`)
- [ ] `GET/POST /v3/smtp/blockedDomains`, `DELETE /v3/smtp/blockedDomains/{domain}`, envoi bloqué vers un domaine listé (événement `blocked`)
- [ ] `POST /v3/smtp/deleteHardbounces`
- [ ] `DELETE /v3/smtp/log/{identifier}` (`from_date`, `to_date`)

**[W14](https://github.com/Devitek/mailsink/issues/173). Limites et quotas réalistes par provider** (M, P3, `area:ingestion`)
- [ ] Profils par défaut optionnels : Resend 10 req/s partagés par workspace, Brevo par route (1000 RPS envoi, 2 RPS `GET /v3/smtp/emails`, 300 RPH autres routes `/v3/smtp`)
- [ ] En-têtes de limite toujours présents quand un profil est actif ; amender D91
- [ ] Quotas Resend : `x-resend-monthly-quota`, `x-resend-daily-quota`, `429 daily_quota_exceeded` / `monthly_quota_exceeded`
- [ ] Clés Resend en accès « envoi seulement » (`401 restricted_api_key`)

**[W15](https://github.com/Devitek/mailsink/issues/174). Validations d'envoi restantes** (S, P3, `area:ingestion`)
- [ ] Resend : 75 tags maximum, types de fichiers non pris en charge, `content_id` < 128 caractères
- [ ] Brevo : `sender.id` (D125), tailles de `params`, extensions de pièces jointes, en-têtes en Title-Case et en-têtes standard refusés, booléens de suivi validés
- [ ] Brevo : bornes des `tags` alignées sur Brevo (D125)

**[W16](https://github.com/Devitek/mailsink/issues/175). API de gestion des webhooks au format provider** (L, P3, `area:webhooks`)
- [ ] Resend `/webhooks` (CRUD, rotation du secret, événements, tentatives, rejeu)
- [ ] Brevo `/v3/webhooks` (CRUD, `auth`, `headers`, `batched`, 40 webhooks maximum)
- [ ] Webhooks Brevo groupés (`batched`, fenêtres de 5 minutes, 500 événements)

**[W17](https://github.com/Devitek/mailsink/issues/176). Erreurs génériques et idempotence concurrente Resend** (S, P3, `area:ingestion`)
- [ ] `404 not_found` et `405 method_not_allowed` JSON sur les chemins Resend inconnus (à vérifier en réel, #107)
- [ ] `409 concurrent_idempotent_requests` pendant le traitement d'une même clé
- [ ] En-tête SMTP `Resend-Idempotency-Key` (`area:smtp`)

**[W18](https://github.com/Devitek/mailsink/issues/177). Statistiques et journaux Resend** (M, P3, `area:ingestion`)
- [ ] `GET /emails/metrics` (totaux, dimensions `period`, `domain`, `email`, taux)
- [ ] `GET /logs`, `GET /logs/:id` depuis le journal des requêtes (D145)

## 4. Deliberate Mailsink divergences

| Decision | Divergence | Keep? |
|---|---|---|
| D20 | Webhook format decoupled from the ingestion channel; `unified` format | Keep: a superset, invisible to an app that uses one provider |
| D21, D25, D120 | Formatter location, prefixed ids, Resend id = UUID of `msg_` | Keep: internal, the wire ids are UUIDs as Resend |
| D22 | Resend emits nothing for `email.suppressed` | **Revise** ([W5](https://github.com/Devitek/mailsink/issues/164)): Resend now documents `email.suppressed` (webhooks/emails/suppressed); D153 carries the same wrong premise |
| D22 | Soft bounce mapped to Resend `email.delivery_delayed` | Keep: Resend `email.bounced` is permanent only (event-types) |
| D23 | No Brevo signature, auth by bearer, basic, headers | Keep (docs/secured-webhooks) |
| D23 | Brevo `date` in the workspace timezone, UTC by default | **Revise the default** ([W6](https://github.com/Devitek/mailsink/issues/165)): Brevo states CET/CEST or the account timezone |
| D24, D139 | Replay `exact` mode and `resign` | Keep: `resign` matches Resend's replay, `exact` is a testing extension |
| D53 (as used by Resend) | Concurrent same key replays the winner | Revise ([W17](https://github.com/Devitek/mailsink/issues/176)), low priority |
| D90, D91 | No default rate limit, headers only when a limit applies, per connection | Revise as an opt-in profile ([W14](https://github.com/Devitek/mailsink/issues/173)); keep « unlimited » as the default for test speed |
| D93, D127 | Chaos body code `chaos_injected`; Brevo `429` code `too_many_requests` | Keep: chaos is a Mailsink feature; Brevo documents no 429 code |
| D121 | Resend batch all-or-nothing by default | Keep (provider parity) |
| D122 | `403 restricted_api_key` for a key of another connection kind | Keep: Mailsink concept; Resend uses the same name for an unusable key |
| D123 | Hosted templates refused | **Revise** ([W1](https://github.com/Devitek/mailsink/issues/160)) |
| D123 | Attachment `path` refused | **Revise** ([W2](https://github.com/Devitek/mailsink/issues/161)), with SSRF guard |
| D123 | `scheduled_at` not honoured | **Revise** ([W4](https://github.com/Devitek/mailsink/issues/163)) |
| D123 | No plain text from `html` | **Revise** ([W8](https://github.com/Devitek/mailsink/issues/167)) |
| D123 | `topic_id` ignored | Keep until contacts and topics exist (out of scope) |
| D125 | `sender.id` refused | Revise at low priority ([W15](https://github.com/Devitek/mailsink/issues/174)): accept and resolve to a configured sender, or keep refusing with a clear message |
| D125 | `url` attachments never fetched | **Revise** ([W2](https://github.com/Devitek/mailsink/issues/161)) |
| D125 | `scheduledAt` not delayed, 201 | **Revise** ([W4](https://github.com/Devitek/mailsink/issues/163)): Brevo answers 202 |
| D125 | Tags capped at 50 × 256 | Revise ([W15](https://github.com/Devitek/mailsink/issues/174)): not a Brevo rule |
| D126 | Template renderer subset | **Revise** ([W12](https://github.com/Devitek/mailsink/issues/171)), keeping the safe-rendering principle |
| D128 | Templates only through the Admin API | Keep the Admin API, add the Brevo route ([W11](https://github.com/Devitek/mailsink/issues/170)) |
| D138 | One retry schedule for every format | **Revise** ([W7](https://github.com/Devitek/mailsink/issues/166)): Resend and Brevo document different schedules and stop rules |
| D143 | At most one open and one click per recipient | Revise ([W6](https://github.com/Devitek/mailsink/issues/165)): Brevo distinguishes `opened` and `unique_opened` |
| D275 | `GET /v3/smtp/emails` limited to the calling connection | Keep (a Brevo account is one connection); UTC days tracked in #153 |
| D276 | Blocked contacts read the workspace suppression list | Keep |
| D277 | `failed` mapped to `invalid_email` | Already refused by the owner, replaced in #153 |
| D278, D279 | URL credentials moved to `brevoAuth`; Brevo idempotency semantics | Keep: they follow Brevo documentation |

Points to verify live (to add to #107): Brevo 401 body and message, Brevo error messages,
Brevo behaviour when sending with an inactive template, Resend body on an unknown route or
method, Resend error when a `path` attachment cannot be fetched.
