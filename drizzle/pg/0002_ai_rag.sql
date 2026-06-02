CREATE TABLE IF NOT EXISTS "ai_conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "spec_id" text NOT NULL,
  "kind" text NOT NULL,
  "title" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ai_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ai_generations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "spec_id" text NOT NULL,
  "conversation_id" uuid,
  "kind" text NOT NULL,
  "input_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "output_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "validation_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "attempt" integer DEFAULT 1 NOT NULL,
  "status" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "endpoint_index" (
  "spec_id" text NOT NULL,
  "endpoint_key" text NOT NULL,
  "method" text NOT NULL,
  "path" text NOT NULL,
  "requires_auth" boolean DEFAULT false NOT NULL,
  "summary" text,
  "search_text" text DEFAULT '' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "endpoint_index_spec_id_endpoint_key_pk" PRIMARY KEY("spec_id","endpoint_key")
);

CREATE TABLE IF NOT EXISTS "openapi_chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "spec_id" text NOT NULL,
  "chunk_key" text NOT NULL,
  "chunk_type" text NOT NULL,
  "endpoint_key" text,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "embedding_json" jsonb,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "flow_ai_cache" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "spec_id" text NOT NULL,
  "cache_key" text NOT NULL,
  "flow_schema_json" jsonb NOT NULL,
  "internal_flow_json" jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_spec_id_specs_id_fk" FOREIGN KEY ("spec_id") REFERENCES "public"."specs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_spec_id_specs_id_fk" FOREIGN KEY ("spec_id") REFERENCES "public"."specs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "endpoint_index" ADD CONSTRAINT "endpoint_index_spec_id_specs_id_fk" FOREIGN KEY ("spec_id") REFERENCES "public"."specs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "openapi_chunks" ADD CONSTRAINT "openapi_chunks_spec_id_specs_id_fk" FOREIGN KEY ("spec_id") REFERENCES "public"."specs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "flow_ai_cache" ADD CONSTRAINT "flow_ai_cache_spec_id_specs_id_fk" FOREIGN KEY ("spec_id") REFERENCES "public"."specs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "ai_conversations_spec_idx" ON "ai_conversations" USING btree ("spec_id");
CREATE INDEX IF NOT EXISTS "ai_messages_conversation_idx" ON "ai_messages" USING btree ("conversation_id");
CREATE INDEX IF NOT EXISTS "ai_generations_spec_created_idx" ON "ai_generations" USING btree ("spec_id","created_at");
CREATE INDEX IF NOT EXISTS "endpoint_index_spec_method_idx" ON "endpoint_index" USING btree ("spec_id","method");
CREATE UNIQUE INDEX IF NOT EXISTS "openapi_chunks_spec_chunk_key_uq" ON "openapi_chunks" USING btree ("spec_id","chunk_key");
CREATE INDEX IF NOT EXISTS "openapi_chunks_spec_type_idx" ON "openapi_chunks" USING btree ("spec_id","chunk_type");
CREATE UNIQUE INDEX IF NOT EXISTS "flow_ai_cache_spec_key_uq" ON "flow_ai_cache" USING btree ("spec_id","cache_key");
