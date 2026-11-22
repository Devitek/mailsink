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
  A-->>R: workspace + connection (401/535 otherwise, logged)
  A--)DB: touch last_activity_at, expires_at (throttled, D16)

  R->>S: effective settings(workspace, connection)
  Note over S: connection override > workspace override ><br/>connection settings > workspace settings
  S-->>R: rates, rules, latency, chaos, rateLimit
  R->>L: take(connection, rateLimit)
  alt bucket empty
    L-->>R: denied, resetAt
    R-->>C: 429 + Retry-After + X-RateLimit-* | SMTP 451 4.7.1
  end
  alt chaos draw hits errorRate
    R-->>C: 500/503/429 | SMTP 421/451/550 (nothing stored, api_log errorCode=chaos_injected)
  end

  R->>P: ingest(normalized, ctx, idempotencyKey)
  P->>DB: idempotency lookup (replay stored response if same hash, 409 if different)
  P->>P: compose EML if missing (D9), extract links, check suppression list
  P->>DB: TX: blobs, message(status=queued), recipients, attachments,<br/>event accepted (+ suppressed), idempotency row,<br/>job simulate_delivery(run_at = now + latency or rule delay)
  P->>B: publish message.created
  P-->>R: message ids
  R-->>C: 200 {id} | 201 {messageId} | 250 queued as msg_…
  R--)DB: api_logs / smtp_sessions (async, redacted)

  Note over Q: polls jobs FOR UPDATE SKIP LOCKED
  Q->>DB: claim simulate_delivery
  Q->>S: draw per recipient: deterministic rule match first, else weighted rates
  Q->>DB: TX: event sent + final status per recipient, aggregate message.status,<br/>hard_bounce/complained -> suppressions upsert,<br/>deferred -> new job later (then delivered or bounce),<br/>webhook_deliveries rows + deliver_webhook jobs
  Q->>B: publish message.status, message.event

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

  B-->>U: SSE event (id = evt_…)
  U->>U: Query: setQueryData(inbox) / invalidate(message, logs)
  U->>U: wait=true and MCP wait_for_email resolve on match

  opt Manual event (E2E test, UI link click, MCP trigger_email_event)
    U->>R: POST /_capture/messages/:id/events {type: clicked, url}
    R->>DB: event clicked + webhook deliveries + jobs
    R->>B: publish message.event
  end

  Note over DB: Schedulers: retention purge, override expiry,<br/>ephemeral GC (expires_at < now -> DELETE CASCADE),<br/>idempotency cleanup
```

## Notes

- **Ordering guarantee**: one transaction writes the message and its first job, so a
  crash never leaves a message without its simulation, and the worker never sees a job
  whose message is not committed.
- **Latency semantics**: the HTTP/SMTP reply is immediate; `latency` and rule `delayMs`
  delay the transition from `queued` to the final status (what providers do). Chaos is
  the only knob that slows or fails the request itself (`chaos.slowMs` can be added later).
- **wait=true** subscribes to the bus *before* running the query, so a message committed
  between the query and the subscription is not missed.
- **Ephemeral GC** publishes `workspace.deleted` to close open SSE streams and MCP
  sessions of that workspace.
