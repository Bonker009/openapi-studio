CREATE TABLE IF NOT EXISTS "db_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "spec_id" text NOT NULL,
  "label" text NOT NULL,
  "host" text NOT NULL,
  "port" integer DEFAULT 5432 NOT NULL,
  "database" text NOT NULL,
  "username" text NOT NULL,
  "ssl_mode" text DEFAULT 'prefer' NOT NULL,
  "encrypted_secret" text NOT NULL,
  "read_only" boolean DEFAULT true NOT NULL,
  "terms_version" text NOT NULL,
  "accepted_at" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "last_tested_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "db_schema_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "connection_id" uuid NOT NULL,
  "schema_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "table_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "db_rag_chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "connection_id" uuid NOT NULL,
  "chunk_key" text NOT NULL,
  "table_name" text NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "embedding_json" jsonb,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "db_query_audit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "connection_id" uuid NOT NULL,
  "sql_hash" text NOT NULL,
  "sql_preview" text NOT NULL,
  "row_count" integer,
  "duration_ms" integer,
  "success" boolean NOT NULL,
  "error_message" text,
  "source" text DEFAULT 'agent' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "db_consent_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "connection_id" uuid,
  "spec_id" text NOT NULL,
  "action" text NOT NULL,
  "terms_version" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "db_connections" ADD CONSTRAINT "db_connections_spec_id_specs_id_fk" FOREIGN KEY ("spec_id") REFERENCES "public"."specs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "db_schema_snapshots" ADD CONSTRAINT "db_schema_snapshots_connection_id_db_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."db_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "db_rag_chunks" ADD CONSTRAINT "db_rag_chunks_connection_id_db_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."db_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "db_query_audit" ADD CONSTRAINT "db_query_audit_connection_id_db_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."db_connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "db_consent_events" ADD CONSTRAINT "db_consent_events_connection_id_db_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."db_connections"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "db_consent_events" ADD CONSTRAINT "db_consent_events_spec_id_specs_id_fk" FOREIGN KEY ("spec_id") REFERENCES "public"."specs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "db_connections_spec_idx" ON "db_connections" USING btree ("spec_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "db_schema_snapshots_connection_idx" ON "db_schema_snapshots" USING btree ("connection_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "db_rag_chunks_connection_chunk_key_uq" ON "db_rag_chunks" USING btree ("connection_id","chunk_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "db_rag_chunks_connection_idx" ON "db_rag_chunks" USING btree ("connection_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "db_query_audit_connection_created_idx" ON "db_query_audit" USING btree ("connection_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "db_consent_events_spec_idx" ON "db_consent_events" USING btree ("spec_id");
