DROP INDEX "messages_ws_created_idx";--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "failed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "messages_search_gin" ON "messages" USING gin (to_tsvector('simple', left("subject" || ' ' || coalesce("text", '') || ' ' ||
    coalesce("html", ''), 100000)));--> statement-breakpoint
CREATE INDEX "messages_ws_created_idx" ON "messages" USING btree ("workspace_id","created_at","id");--> statement-breakpoint
-- Hand-written backfill: jobs given up on before this migration start their grace period now.
UPDATE "jobs" SET "failed_at" = now() WHERE "run_at" = '9999-12-31T00:00:00Z' AND "failed_at" IS NULL;
