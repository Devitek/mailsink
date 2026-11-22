ALTER TABLE "workspaces" ALTER COLUMN "simulation" SET DEFAULT '{"rates":{"delivered":100},"rules":[],"latency":{"minMs":0,"maxMs":0},"openRate":0,"clickRate":0}'::jsonb;--> statement-breakpoint
CREATE INDEX "attachments_message_idx" ON "attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "attachments_blob_idx" ON "attachments" USING btree ("blob_id");--> statement-breakpoint
CREATE INDEX "messages_raw_blob_idx" ON "messages" USING btree ("raw_blob_id");--> statement-breakpoint
CREATE INDEX "attempts_delivery_idx" ON "webhook_attempts" USING btree ("delivery_id");--> statement-breakpoint
-- Hand-written backfill: 0000 stored `rates` only; complete rows with the contract defaults,
-- keys already stored win (shallow merge, so a stored `rates` replaces the default one).
UPDATE "workspaces" SET "simulation" = '{"rates":{"delivered":100},"rules":[],"latency":{"minMs":0,"maxMs":0},"openRate":0,"clickRate":0}'::jsonb || "simulation";
