# 4. End-to-end sequence

Ingestion (API/SMTP) -> activity & TTL -> rate limit -> override/default resolution ->
status & storage -> signed webhook -> SSE / TanStack Query / MCP.

```mermaid
sequenceDiagram
  autonumber
  participant C as Client (SDK / Nodemailer)
  participant R as Server route or SMTP session
  participant A as Auth + Activity
  participant L as Rate limiter
  participant S as Settings resolver
  participant P as Ingestion pipeline
  participant DB as Postgres / PGlite
  participant Q as Job worker
  participant W as Webhook dispatcher
  participant B as Event bus
  participant U as UI (SSE + Query) / MCP / wait=true

  C->>R: POST /emails (Resend) | /v3/smtp/email (Brevo) | /v1/emails | SMTP DATA
  R->>R: Dialect schema (Zod) -> NormalizedEmail
  R->>A: resolve credential (msk_ sha256 | SMTP scrypt cache)
  A-->>R: workspace + connection (401/535 otherwise, logged without body)
  R->>R: request log: clone the body (read in the background, D146)
  A--)DB: touch last_activity_at, expires_at (throttled, D16)

  R->>S: effective settings(workspace, connection)
  Note over S: connection override > workspace override ><br/>connection settings > workspace settings
  S-->>R: rates, rules, latency, chaos, rateLimit
  R->>L: take(connection, rateLimit)
  alt bucket empty
    L-->>R: denied, resetAt
    R-->>C: 429 + Retry-After + X-RateLimit-* | SMTP 451 4.7.1
    R--)DB: api_logs errorCode=rate_limited (async)
  end
  alt chaos draw hits errorRate
    R-->>C: 429/500/502/503 | SMTP 421/451/452/550 (nothing stored)
    R--)DB: api_logs errorCode=chaos_injected (async)
  end

  R->>P: ingest(normalized, ctx, idempotencyKey)
  P->>DB: idempotency lookup (replay stored response if same hash, 409 if different)
  P->>P: compose EML if missing (D9), extract links, check suppression list
  P->>DB: TX: blobs, message(status=queued), recipients, attachments,<br/>event accepted (+ suppressed), idempotency row,<br/>job simulate_delivery(run_at = now, D70)
  P->>B: after commit: publish message.created (+ message.event suppressed, D81)
  P-->>R: message ids
  R-->>C: 200 {id} | 201 {messageId} | 250 queued as msg_…
  R--)DB: api_logs / smtp_sessions (async: headers redacted, attachments stripped,<br/>bodies truncated, transcript capped, D145 to D147)
  R--)B: publish log.api | log.smtp (derived, no SSE id)

  Note over Q: polls jobs FOR UPDATE SKIP LOCKED
  Q->>DB: claim simulate_delivery
  Q->>S: first run: effective settings (overrides active now), per recipient<br/>rule match first, else weighted draw; status + delay (D70, D71)
  Q->>DB: TX (message locked): queued -> event sent, decisions in messages.simulation,<br/>aggregate message.status, follow-up job at the earliest pending decision
  Note over Q: follow-up run, once a delay is over
  Q->>DB: TX: event + final status per due recipient,<br/>hard_bounce/complained -> suppressions upsert,<br/>deferred -> decided again 1 s + delay later (4th: soft_bounce, D72),<br/>next follow-up job if a decision is pending,<br/>webhook_deliveries rows + deliver_webhook jobs (#33)
  Q->>B: after commit: message.event per written row, then message.status (D95)

  Note over Q,W: fan-out at status time: endpoints whose scope matches (connection or<br/>workspace) and whose canonical events include it. Formatter chosen by the<br/>endpoint payloadFormat, never by the ingestion channel (D20). Body serialized once.
  Q->>W: claim deliver_webhook
  W->>W: formatters[payloadFormat].sign(stored body, attempt timestamp)<br/>unified: X-Mailsink-* · resend: svix-* · brevo: Authorization / custom headers
  W->>C: POST endpoint URL (10 s timeout)
  alt 2xx
    W->>DB: attempt (exact headers sent) + delivery succeeded
  else error / non-2xx
    W->>DB: attempt + retrying, job run_at = backoff(n)
  end
  W->>B: publish webhook.delivery

  B-->>U: SSE event (id = evt_… for message events; none for derived frames)
  U->>U: Query: setQueryData(inbox) / invalidate(message, logs)
  U->>U: wait=true and MCP wait_for_email resolve on match

  opt Manual event (E2E test, UI link click, MCP trigger_email_event)
    U->>R: POST /capture/messages/:id/events {type: clicked, url}
    R->>DB: event clicked + webhook deliveries + jobs
    R->>B: publish message.event
  end

  opt Override API (POST /capture/override, /capture/override/reset)
    U->>R: activate or reset (optional TTL)
    R->>DB: TX: close the open override of the scope, insert the new one
    R->>B: publish override.changed (D96)
  end

  Note over DB: Schedulers: retention purge, override expiry (5 s, publishes<br/>override.changed, D96), ephemeral GC (30 s, expires_at < now -><br/>DELETE CASCADE, publishes workspace.deleted), idempotency cleanup
```

## Notes

- **Ordering guarantee**: one transaction writes the message and its first job, so a
  crash never leaves a message without its simulation, and the worker never sees a job
  whose message is not committed.
- **Latency semantics**: the HTTP/SMTP reply is immediate and the first job runs at once;
  `latency` and rule `delayMs` are per recipient, so they delay the transition from `sent`
  to the final status through follow-up jobs (D70), what providers do. Chaos is the only
  knob that slows or fails the request itself (`chaos.slowMs` can be added later).
- **Simulation files** (`packages/core/src/simulation/`): `simulate-delivery.ts` is one
  run (steps above); `settings-planner.ts` is the default `DeliveryPlanner`
  (`planner.ts`), it loads the four layers (`load-settings.ts`, `settings-resolver.ts`)
  and decides each recipient (`decide.ts`: `rules.ts` globs, then `draw.ts` with the
  `rng.ts` generator); `recorder.ts` writes statuses, events and suppressions;
  `aggregate.ts` derives the message status; `snapshot.ts` reads and checks
  `messages.simulation`. The job side is `jobs/handlers/simulate.ts` (payload, run) and
  `simulate-publish.ts` (frames of the rows the run returns, D95).
- **Duplicated follow-up job**: a crash between the commit of a run and the deletion of
  its job runs the job again; that replay writes no event but may enqueue a second
  follow-up job, which later completes without effect (doc 02, D99).
- **Request log** (#35): every call of a logged surface writes one `api_logs` row after
  its response is built, refused calls included (`unauthorized`, `rate_limited`,
  `chaos_injected`, validation errors); reading the logs and the SSE stream are not
  logged (D145). The write is asynchronous and never fails the call; the runtime stop
  waits for the pending writes before closing the database. SMTP sessions are written by
  `recordSmtpSession` once the session ends.
- **Dev restart** (`vite dev`, D148): requests arriving while a restart is debounced or
  running wait for the new runtime; the restart waits up to 10 s for the requests still
  running on the old one (each keeps the runtime it started on), then stops it and boots
  the new code.
- **wait=true** subscribes to the bus *before* running the query, so a message committed
  between the query and the subscription is not missed.
- **Workspace deletion**: the ephemeral GC and `DELETE /admin/workspaces/:id` (D97) both
  publish `workspace.deleted`, which closes the open SSE streams and ends the `wait=true`
  calls of that workspace (404); MCP sessions follow with #44.
