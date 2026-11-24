ALTER TYPE "public"."delivery_status" ADD VALUE 'invalid' BEFORE 'suppressed';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE 'invalid' BEFORE 'suppressed';--> statement-breakpoint
-- Hand-written (#153): webhook_event is recreated instead of `ADD VALUE`, because a value
-- added to an existing enum cannot be used in the migration transaction, and the backfill
-- below writes 'email.invalid'.
ALTER TYPE "public"."webhook_event" RENAME TO "webhook_event_0003";--> statement-breakpoint
CREATE TYPE "public"."webhook_event" AS ENUM('email.sent', 'email.delivered', 'email.deferred', 'email.soft_bounced', 'email.hard_bounced', 'email.complained', 'email.opened', 'email.clicked', 'email.suppressed', 'email.failed', 'email.invalid');--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ALTER COLUMN "events" SET DATA TYPE "public"."webhook_event"[] USING "events"::text[]::"public"."webhook_event"[];--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ALTER COLUMN "canonical_event" SET DATA TYPE "public"."webhook_event" USING "canonical_event"::text::"public"."webhook_event";--> statement-breakpoint
DROP TYPE "public"."webhook_event_0003";--> statement-breakpoint
-- Resend emits email.invalid as `email.failed` (D280): a Resend endpoint subscribed to it keeps
-- receiving every event of that name.
UPDATE "webhook_endpoints" SET "events" = array_append("events", 'email.invalid')
  WHERE "payload_format" = 'resend' AND 'email.failed' = ANY("events")
    AND NOT 'email.invalid' = ANY("events");--> statement-breakpoint
-- Credentials written in a brevo endpoint URL before D278 move to brevo_auth basic,
-- percent-decoded like decodeURIComponent (a part that does not decode is kept as written),
-- as create and PATCH do now (D281). Other rows keep the send-time fallback.
CREATE FUNCTION pg_temp.mailsink_percent_decode(value text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF value = '' THEN
    RETURN '';
  END IF;
  RETURN (
    SELECT convert_from(string_agg(
      CASE WHEN t.m[1] IS NOT NULL THEN decode(substr(t.m[1], 2), 'hex')
      ELSE convert_to(t.m[2], 'UTF8') END, ''::bytea ORDER BY t.n), 'UTF8')
    FROM regexp_matches(value, '(%[0-9A-Fa-f]{2})|([^%]+|%)', 'g') WITH ORDINALITY AS t(m, n)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN value;
END
$$;--> statement-breakpoint
WITH "split" AS (
  SELECT "id", regexp_match("url", '^([A-Za-z][A-Za-z0-9+.-]*://)([^/?#]*)@(.*)$') AS "m"
  FROM "webhook_endpoints"
  WHERE "payload_format" = 'brevo' AND "brevo_auth" = 'none'
    AND "url" ~ '^[A-Za-z][A-Za-z0-9+.-]*://[^/?#]*@'
)
UPDATE "webhook_endpoints" AS "e" SET
  "url" = "s"."m"[1] || "s"."m"[3],
  "brevo_auth" = 'basic',
  "secret" = pg_temp.mailsink_percent_decode(split_part("s"."m"[2], ':', 1)) || ':' ||
    pg_temp.mailsink_percent_decode(CASE WHEN position(':' in "s"."m"[2]) > 0
      THEN substr("s"."m"[2], position(':' in "s"."m"[2]) + 1) ELSE '' END)
FROM "split" AS "s" WHERE "e"."id" = "s"."id";--> statement-breakpoint
DROP FUNCTION pg_temp.mailsink_percent_decode(text);
