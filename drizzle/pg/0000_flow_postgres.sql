CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_id text NOT NULL,
  flow_key text NOT NULL,
  name text NOT NULL,
  description text,
  base_url text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  environment_id uuid REFERENCES environments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flows_spec_id_idx ON flows(spec_id);
CREATE UNIQUE INDEX IF NOT EXISTS flows_spec_flow_key_uq ON flows(spec_id, flow_key);
CREATE INDEX IF NOT EXISTS flows_env_id_idx ON flows(environment_id);

CREATE TABLE IF NOT EXISTS flow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  name text NOT NULL,
  method text NOT NULL,
  url text NOT NULL,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  body jsonb,
  auth jsonb,
  step_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  order_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS flow_steps_flow_step_key_uq
  ON flow_steps(flow_id, step_key);
CREATE INDEX IF NOT EXISTS flow_steps_flow_order_idx
  ON flow_steps(flow_id, order_index);

CREATE TABLE IF NOT EXISTS flow_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_id text NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS flow_collection_items (
  collection_id uuid NOT NULL REFERENCES flow_collections(id) ON DELETE CASCADE,
  flow_id uuid NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, flow_id)
);

CREATE INDEX IF NOT EXISTS flow_collection_items_order_idx
  ON flow_collection_items(collection_id, order_index);

CREATE TABLE IF NOT EXISTS flow_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  version text NOT NULL,
  note text,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flow_versions_flow_created_idx
  ON flow_versions(flow_id, created_at);

CREATE TABLE IF NOT EXISTS flow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  status text NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  duration_ms integer,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS flow_runs_flow_started_idx
  ON flow_runs(flow_id, started_at DESC);

CREATE TABLE IF NOT EXISTS step_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES flow_runs(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES flow_steps(id) ON DELETE RESTRICT,
  status text NOT NULL,
  duration_ms integer,
  assertion_result jsonb,
  extracted_values jsonb,
  request_summary jsonb,
  response_summary jsonb,
  error_message text
);

CREATE INDEX IF NOT EXISTS step_results_run_step_idx
  ON step_results(run_id, step_id);
