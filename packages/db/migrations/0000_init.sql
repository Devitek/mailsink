CREATE TYPE "public"."api_dialect" AS ENUM('native', 'resend', 'brevo', 'admin', 'capture', 'mcp');--> statement-breakpoint
CREATE TYPE "public"."api_key_scope" AS ENUM('workspace', 'connection');--> statement-breakpoint
CREATE TYPE "public"."brevo_auth_type" AS ENUM('none', 'bearer', 'basic');--> statement-breakpoint
CREATE TYPE "public"."connection_kind" AS ENUM('resend', 'brevo', 'smtp');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('queued', 'sent', 'delivered', 'deferred', 'soft_bounce', 'hard_bounce', 'complained', 'failed', 'suppressed');--> statement-breakpoint
CREATE TYPE "public"."event_origin" AS ENUM('simulation', 'api', 'ui', 'mcp');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('accepted', 'sent', 'delivered', 'deferred', 'soft_bounce', 'hard_bounce', 'complained', 'failed', 'suppressed', 'opened', 'clicked');--> statement-breakpoint
CREATE TYPE "public"."message_source" AS ENUM('native', 'resend', 'brevo', 'smtp');--> statement-breakpoint
CREATE TYPE "public"."payload_format" AS ENUM('unified', 'resend', 'brevo');--> statement-breakpoint
CREATE TYPE "public"."recipient_kind" AS ENUM('to', 'cc', 'bcc');--> statement-breakpoint
CREATE TYPE "public"."replay_mode" AS ENUM('exact', 'resign');--> statement-breakpoint
CREATE TYPE "public"."smtp_outcome" AS ENUM('accepted', 'rejected', 'auth_failed', 'error');--> statement-breakpoint
CREATE TYPE "public"."suppression_reason" AS ENUM('hard_bounce', 'complained', 'manual');--> statement-breakpoint
CREATE TYPE "public"."webhook_delivery_status" AS ENUM('pending', 'retrying', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."webhook_event" AS ENUM('email.sent', 'email.delivered', 'email.deferred', 'email.soft_bounced', 'email.hard_bounced', 'email.complained', 'email.opened', 'email.clicked', 'email.suppressed', 'email.failed');--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"filename" text,
	"content_type" text NOT NULL,
	"content_id" text,
	"disposition" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"blob_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blobs" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"sha256" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" "connection_kind" NOT NULL,
	"smtp_username" text,
	"smtp_password_hash" text,
	"retention_seconds" integer,
	"rate_limit" jsonb,
	"simulation" jsonb,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connections_smtp_username_unique" UNIQUE("smtp_username"),
	CONSTRAINT "connections_smtp_creds" CHECK (("connections"."kind" = 'smtp') = ("connections"."smtp_username" is not null))
);
--> statement-breakpoint
CREATE TABLE "message_events" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"message_id" text NOT NULL,
	"recipient_email" text,
	"type" "event_type" NOT NULL,
	"origin" "event_origin" NOT NULL,
	"data" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"workspace_id" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" integer NOT NULL,
	"response_body" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "idempotency_keys_workspace_id_key_pk" PRIMARY KEY("workspace_id","key")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"workspace_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"connection_id" text,
	"scope" "api_key_scope" NOT NULL,
	"name" text,
	"display_prefix" text NOT NULL,
	"hash" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_hash_unique" UNIQUE("hash"),
	CONSTRAINT "api_keys_scope" CHECK (("api_keys"."scope" = 'connection') = ("api_keys"."connection_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "api_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"connection_id" text,
	"dialect" "api_dialect" NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"status_code" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"request_headers" jsonb,
	"request_body" jsonb,
	"response_body" jsonb,
	"message_ids" text[],
	"error_code" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "smtp_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"connection_id" text,
	"remote_address" text NOT NULL,
	"client_hostname" text,
	"auth_user" text,
	"secure" boolean DEFAULT false NOT NULL,
	"transcript" jsonb NOT NULL,
	"message_ids" text[],
	"outcome" "smtp_outcome" NOT NULL,
	"error" text,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "message_recipients" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"kind" "recipient_kind" NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"status" "delivery_status" DEFAULT 'queued' NOT NULL,
	"status_reason" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"connection_id" text,
	"source" "message_source" NOT NULL,
	"provider_message_id" text NOT NULL,
	"from" jsonb NOT NULL,
	"reply_to" jsonb,
	"subject" text DEFAULT '' NOT NULL,
	"html" text,
	"text" text,
	"headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb,
	"template_ref" jsonb,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"raw_blob_id" text,
	"size_bytes" integer NOT NULL,
	"status" "delivery_status" DEFAULT 'queued' NOT NULL,
	"simulation" jsonb,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status_updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"connection_id" text,
	"config" jsonb NOT NULL,
	"activated_via" "event_origin" NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reset_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "suppressions" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"email" text NOT NULL,
	"reason" "suppression_reason" NOT NULL,
	"message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"external_id" integer NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"html" text,
	"text" text,
	"sender" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"delivery_id" text NOT NULL,
	"attempt_no" integer NOT NULL,
	"request_headers" jsonb NOT NULL,
	"signed_at" integer,
	"response_status" integer,
	"response_body" text,
	"duration_ms" integer NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"endpoint_id" text NOT NULL,
	"event_id" text,
	"message_id" text,
	"payload_format" "payload_format" NOT NULL,
	"canonical_event" "webhook_event" NOT NULL,
	"dialect_event" text NOT NULL,
	"recipient" text,
	"body" text NOT NULL,
	"content_type" text DEFAULT 'application/json' NOT NULL,
	"status" "webhook_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"last_status_code" integer,
	"replay_of" text,
	"replay_mode" "replay_mode",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" text PRIMARY KEY NOT NULL,
	"numeric_id" integer GENERATED ALWAYS AS IDENTITY (sequence name "webhook_endpoints_numeric_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"workspace_id" text NOT NULL,
	"connection_id" text,
	"url" text NOT NULL,
	"payload_format" "payload_format" NOT NULL,
	"events" "webhook_event"[] NOT NULL,
	"secret" text,
	"brevo_auth" "brevo_auth_type" DEFAULT 'none' NOT NULL,
	"custom_headers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_endpoints_numeric_id_unique" UNIQUE("numeric_id"),
	CONSTRAINT "webhook_secret_required" CHECK ("webhook_endpoints"."payload_format" = 'brevo' or "webhook_endpoints"."secret" is not null)
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"ephemeral" boolean DEFAULT false NOT NULL,
	"idle_ttl_seconds" integer,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"retention_seconds" integer DEFAULT 604800 NOT NULL,
	"max_messages" integer,
	"rate_limit" jsonb,
	"simulation" jsonb DEFAULT '{"rates":{"delivered":100}}'::jsonb NOT NULL,
	"metadata" jsonb,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"created_via" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_blob_id_blobs_id_fk" FOREIGN KEY ("blob_id") REFERENCES "public"."blobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blobs" ADD CONSTRAINT "blobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_events" ADD CONSTRAINT "message_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_events" ADD CONSTRAINT "message_events_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_logs" ADD CONSTRAINT "api_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_logs" ADD CONSTRAINT "api_logs_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smtp_sessions" ADD CONSTRAINT "smtp_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smtp_sessions" ADD CONSTRAINT "smtp_sessions_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_recipients" ADD CONSTRAINT "message_recipients_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_raw_blob_id_blobs_id_fk" FOREIGN KEY ("raw_blob_id") REFERENCES "public"."blobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overrides" ADD CONSTRAINT "overrides_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overrides" ADD CONSTRAINT "overrides_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppressions" ADD CONSTRAINT "suppressions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppressions" ADD CONSTRAINT "suppressions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_attempts" ADD CONSTRAINT "webhook_attempts_delivery_id_webhook_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."webhook_deliveries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_event_id_message_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."message_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "blobs_dedup_uq" ON "blobs" USING btree ("workspace_id","sha256");--> statement-breakpoint
CREATE INDEX "connections_workspace_idx" ON "connections" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "events_message_idx" ON "message_events" USING btree ("message_id","occurred_at");--> statement-breakpoint
CREATE INDEX "events_ws_time_idx" ON "message_events" USING btree ("workspace_id","occurred_at");--> statement-breakpoint
CREATE INDEX "jobs_due_idx" ON "jobs" USING btree ("run_at");--> statement-breakpoint
CREATE INDEX "api_logs_ws_time_idx" ON "api_logs" USING btree ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "smtp_sessions_ws_time_idx" ON "smtp_sessions" USING btree ("workspace_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "recipients_ws_email_idx" ON "message_recipients" USING btree ("workspace_id","email");--> statement-breakpoint
CREATE INDEX "recipients_message_idx" ON "message_recipients" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "messages_ws_created_idx" ON "messages" USING btree ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_ws_status_idx" ON "messages" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "messages_ws_connection_idx" ON "messages" USING btree ("workspace_id","connection_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_tags_gin" ON "messages" USING gin ("tags");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_provider_id_uq" ON "messages" USING btree ("workspace_id","provider_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "overrides_active_scope_uq" ON "overrides" USING btree ("workspace_id",coalesce("connection_id", '')) WHERE "overrides"."reset_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "suppressions_ws_email_uq" ON "suppressions" USING btree ("workspace_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "templates_external_uq" ON "templates" USING btree ("workspace_id","external_id");--> statement-breakpoint
CREATE INDEX "deliveries_ws_time_idx" ON "webhook_deliveries" USING btree ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "deliveries_message_idx" ON "webhook_deliveries" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "deliveries_ws_format_idx" ON "webhook_deliveries" USING btree ("workspace_id","payload_format");--> statement-breakpoint
CREATE INDEX "webhook_endpoints_scope_idx" ON "webhook_endpoints" USING btree ("workspace_id","connection_id");--> statement-breakpoint
CREATE INDEX "workspaces_expiry_idx" ON "workspaces" USING btree ("expires_at") WHERE "workspaces"."ephemeral";--> statement-breakpoint
CREATE INDEX "workspaces_picker_idx" ON "workspaces" USING btree ("ephemeral","name");