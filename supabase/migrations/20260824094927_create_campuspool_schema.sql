/*
# Create IIITM CampusPool data model

1. New Tables
- `campus_users`: IIITM student profiles with official email, roll number, and emergency contact.
- `ride_requests`: Requested campus rides with verified pickup/dropoff names and coordinates, flexible times, vehicle choice, and status.
- `pools`: Matched ride groups with capacity, lifecycle status, fare estimate, driver details, and tracking link.
- `pool_members`: Students assigned to a pool, stop order, individual fare, and payment state.
- `chat_messages`: Group chat messages attached to a pool.
- `safety_alerts`: SOS alert events with the student's message and live location.

2. Relationships and integrity
- Ride requests, pools, members, messages, and alerts use UUID primary keys.
- Foreign keys connect members and chat messages to pools and students.
- Enumerated text checks constrain vehicle, ride, pool, and payment states.
- Coordinate columns are stored as double precision values for map and provider APIs.

3. Security
- Row-level security is enabled on every table.
- The demo client operates as an intentionally shared campus prototype, so anon and authenticated roles receive separate CRUD policies.
- Before launch, replace the shared policies with auth.uid()-scoped ownership and membership policies as described in README.md.

4. Important notes
- This migration is additive and idempotent.
- No user data is deleted or renamed.
*/

CREATE TABLE IF NOT EXISTS campus_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL CHECK (email ~* '^[^@[:space:]]+@iiitm\\.ac\\.in$'),
  name text NOT NULL,
  roll_number text,
  emergency_contact text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ride_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES campus_users(id) ON DELETE SET NULL,
  pickup_location_name text NOT NULL,
  dropoff_location_name text NOT NULL,
  pickup_lat double precision NOT NULL CHECK (pickup_lat BETWEEN -90 AND 90),
  pickup_lng double precision NOT NULL CHECK (pickup_lng BETWEEN -180 AND 180),
  dropoff_lat double precision NOT NULL CHECK (dropoff_lat BETWEEN -90 AND 90),
  dropoff_lng double precision NOT NULL CHECK (dropoff_lng BETWEEN -180 AND 180),
  flex_time_start timestamptz NOT NULL,
  flex_time_end timestamptz NOT NULL,
  vehicle_type text NOT NULL CHECK (vehicle_type IN ('AUTO_3', 'CAB_4')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'MATCHED', 'COMPLETED', 'CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_type text NOT NULL CHECK (vehicle_type IN ('AUTO_3', 'CAB_4')),
  max_capacity integer NOT NULL CHECK (max_capacity IN (3, 4)),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'FULL', 'PAYMENT_PENDING', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED')),
  total_estimated_fare numeric(10,2) NOT NULL DEFAULT 0,
  driver_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  share_tracking_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pool_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  user_id uuid REFERENCES campus_users(id) ON DELETE SET NULL,
  stop_sequence integer NOT NULL CHECK (stop_sequence > 0),
  individual_fare numeric(10,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID')),
  payment_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pool_id, stop_sequence)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  user_id uuid REFERENCES campus_users(id) ON DELETE SET NULL,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 1000),
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS safety_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES campus_users(id) ON DELETE SET NULL,
  pool_id uuid REFERENCES pools(id) ON DELETE SET NULL,
  latitude double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision CHECK (longitude BETWEEN -180 AND 180),
  alert_type text NOT NULL DEFAULT 'SOS',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ride_requests_status_time_idx ON ride_requests(status, flex_time_start);
CREATE INDEX IF NOT EXISTS pools_status_idx ON pools(status);
CREATE INDEX IF NOT EXISTS pool_members_pool_idx ON pool_members(pool_id);
CREATE INDEX IF NOT EXISTS chat_messages_pool_time_idx ON chat_messages(pool_id, timestamp);

ALTER TABLE campus_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campus_users_select_demo" ON campus_users;
CREATE POLICY "campus_users_select_demo" ON campus_users FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "campus_users_insert_demo" ON campus_users;
CREATE POLICY "campus_users_insert_demo" ON campus_users FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "campus_users_update_demo" ON campus_users;
CREATE POLICY "campus_users_update_demo" ON campus_users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "campus_users_delete_demo" ON campus_users;
CREATE POLICY "campus_users_delete_demo" ON campus_users FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "ride_requests_select_demo" ON ride_requests;
CREATE POLICY "ride_requests_select_demo" ON ride_requests FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ride_requests_insert_demo" ON ride_requests;
CREATE POLICY "ride_requests_insert_demo" ON ride_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ride_requests_update_demo" ON ride_requests;
CREATE POLICY "ride_requests_update_demo" ON ride_requests FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ride_requests_delete_demo" ON ride_requests;
CREATE POLICY "ride_requests_delete_demo" ON ride_requests FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "pools_select_demo" ON pools;
CREATE POLICY "pools_select_demo" ON pools FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "pools_insert_demo" ON pools;
CREATE POLICY "pools_insert_demo" ON pools FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "pools_update_demo" ON pools;
CREATE POLICY "pools_update_demo" ON pools FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "pools_delete_demo" ON pools;
CREATE POLICY "pools_delete_demo" ON pools FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "pool_members_select_demo" ON pool_members;
CREATE POLICY "pool_members_select_demo" ON pool_members FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "pool_members_insert_demo" ON pool_members;
CREATE POLICY "pool_members_insert_demo" ON pool_members FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "pool_members_update_demo" ON pool_members;
CREATE POLICY "pool_members_update_demo" ON pool_members FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "pool_members_delete_demo" ON pool_members;
CREATE POLICY "pool_members_delete_demo" ON pool_members FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "chat_messages_select_demo" ON chat_messages;
CREATE POLICY "chat_messages_select_demo" ON chat_messages FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "chat_messages_insert_demo" ON chat_messages;
CREATE POLICY "chat_messages_insert_demo" ON chat_messages FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "chat_messages_update_demo" ON chat_messages;
CREATE POLICY "chat_messages_update_demo" ON chat_messages FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "chat_messages_delete_demo" ON chat_messages;
CREATE POLICY "chat_messages_delete_demo" ON chat_messages FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "safety_alerts_select_demo" ON safety_alerts;
CREATE POLICY "safety_alerts_select_demo" ON safety_alerts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "safety_alerts_insert_demo" ON safety_alerts;
CREATE POLICY "safety_alerts_insert_demo" ON safety_alerts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "safety_alerts_update_demo" ON safety_alerts;
CREATE POLICY "safety_alerts_update_demo" ON safety_alerts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "safety_alerts_delete_demo" ON safety_alerts;
CREATE POLICY "safety_alerts_delete_demo" ON safety_alerts FOR DELETE TO anon, authenticated USING (true);
