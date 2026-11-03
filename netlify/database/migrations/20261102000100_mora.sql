CREATE TABLE content (id INTEGER PRIMARY KEY CHECK (id=1), version INTEGER NOT NULL, payload TEXT NOT NULL);
CREATE TABLE admin (id INTEGER PRIMARY KEY CHECK (id=1), password TEXT NOT NULL);
CREATE TABLE sessions (hash TEXT PRIMARY KEY, expires BIGINT NOT NULL);
CREATE TABLE media (id TEXT PRIMARY KEY, data BYTEA NOT NULL);
CREATE TABLE limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, until BIGINT NOT NULL);
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  request_key TEXT UNIQUE NOT NULL,
  payload_hash TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  token TEXT NOT NULL,
  "start" BIGINT NOT NULL,
  "end" BIGINT NOT NULL,
  service_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  reference TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('confirmed','cancelled','completed')),
  created BIGINT NOT NULL,
  CHECK ("end">"start"),
  CONSTRAINT booking_overlap EXCLUDE USING gist (int8range("start","end",'[)') WITH &&)
    WHERE (status IN ('confirmed','completed'))
);
CREATE INDEX bookings_range ON bookings(status,"start","end");
CREATE INDEX sessions_expiry ON sessions(expires);
CREATE INDEX limits_expiry ON limits(until);
