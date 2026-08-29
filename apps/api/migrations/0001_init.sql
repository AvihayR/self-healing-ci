-- 0001_init: monitors table.
--
-- Plain SQL, checksummed by Drizzle. Hand-edit an applied migration and the
-- checksum stops matching, which is the migration-drift break the catalogue
-- relies on later.

CREATE TABLE IF NOT EXISTS monitors (
  id               text    PRIMARY KEY,
  url              text    NOT NULL,
  name             text    NOT NULL,
  interval_seconds integer NOT NULL DEFAULT 300,
  -- Epoch milliseconds, UTC. Not timestamptz: the application does all of its
  -- time arithmetic in epoch ms, and converting at the boundary is where a
  -- timezone bug would be introduced without anyone choosing it.
  created_at       bigint  NOT NULL
);

CREATE INDEX IF NOT EXISTS monitors_created_at_idx ON monitors (created_at);
