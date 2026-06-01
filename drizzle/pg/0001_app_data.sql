CREATE TABLE IF NOT EXISTS specs (
  id text PRIMARY KEY,
  openapi_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS spec_versions (
  id serial PRIMARY KEY,
  spec_id text NOT NULL REFERENCES specs(id) ON DELETE CASCADE,
  ts bigint NOT NULL,
  version text NOT NULL,
  note text,
  summary_json jsonb,
  is_restore boolean NOT NULL DEFAULT false,
  snapshot_json jsonb NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS spec_versions_spec_id_ts_uq
  ON spec_versions(spec_id, ts);

CREATE TABLE IF NOT EXISTS endpoint_statuses (
  spec_id text NOT NULL REFERENCES specs(id) ON DELETE CASCADE,
  path text NOT NULL,
  method text NOT NULL,
  working boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  PRIMARY KEY (spec_id, path, method)
);

CREATE TABLE IF NOT EXISTS spec_settings (
  spec_id text PRIMARY KEY REFERENCES specs(id) ON DELETE CASCADE,
  expanded_controllers_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS endpoint_notes (
  id serial PRIMARY KEY,
  spec_id text NOT NULL REFERENCES specs(id) ON DELETE CASCADE,
  path text NOT NULL,
  method text NOT NULL,
  ts bigint NOT NULL,
  kind text NOT NULL DEFAULT 'note',
  body text NOT NULL
);

CREATE INDEX IF NOT EXISTS endpoint_notes_lookup_idx
  ON endpoint_notes(spec_id, path, method, ts DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'flows_spec_id_specs_fkey'
  ) THEN
    ALTER TABLE flows
      ADD CONSTRAINT flows_spec_id_specs_fkey
      FOREIGN KEY (spec_id) REFERENCES specs(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'flow_collections_spec_id_specs_fkey'
  ) THEN
    ALTER TABLE flow_collections
      ADD CONSTRAINT flow_collections_spec_id_specs_fkey
      FOREIGN KEY (spec_id) REFERENCES specs(id) ON DELETE CASCADE;
  END IF;
END $$;
