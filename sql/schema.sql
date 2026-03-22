-- ═══════════════════════════════════════════════════════════
--  HemoSync — PostgreSQL Database Schema
--  Run this file once to initialise the full database.
--  psql -U postgres -d hemosync -f schema.sql
-- ═══════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── ENUM TYPES ────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('hospital', 'donor', 'individual');

CREATE TYPE blood_type AS ENUM (
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
);

CREATE TYPE blood_component AS ENUM (
  'Whole Blood',
  'Packed Red Blood Cells (PRBC)',
  'Fresh Frozen Plasma (FFP)',
  'Platelets',
  'Cryoprecipitate'
);

CREATE TYPE urgency_level AS ENUM ('Normal', 'Urgent', 'Critical');

CREATE TYPE request_status AS ENUM (
  'pending', 'approved', 'enroute', 'done', 'cancelled'
);

CREATE TYPE donation_status AS ENUM ('scheduled', 'done', 'cancelled');

-- ─── USERS TABLE ───────────────────────────────────────────

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(150) NOT NULL,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  role            user_role NOT NULL,
  blood_type      blood_type,
  phone           VARCHAR(20),
  city            VARCHAR(100),
  address         TEXT,
  is_verified     BOOLEAN DEFAULT FALSE,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Hospital-specific profile (linked 1-to-1 with users where role='hospital')
CREATE TABLE hospital_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_name        VARCHAR(200) NOT NULL,
  authorized_person VARCHAR(150),
  hospital_type   VARCHAR(50) CHECK (hospital_type IN ('Government','Private','Trust / NGO')),
  bed_capacity    INTEGER,
  licence_number  VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Donor-specific profile
CREATE TABLE donor_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weight_kg       NUMERIC(5,1),
  gender          VARCHAR(20),
  date_of_birth   DATE,
  last_donated_at TIMESTAMPTZ,
  total_donations INTEGER DEFAULT 0,
  streak          INTEGER DEFAULT 0,
  donor_level     VARCHAR(50) DEFAULT 'Bronze',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Individual-specific profile
CREATE TABLE individual_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_of_birth   DATE,
  gender          VARCHAR(20),
  allergies       TEXT,
  chronic_conditions TEXT,
  medications     TEXT,
  primary_doctor  VARCHAR(150),
  weight_kg       NUMERIC(5,1),
  height_cm       NUMERIC(5,1),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── REFRESH TOKENS ────────────────────────────────────────

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BLOOD INVENTORY ───────────────────────────────────────

CREATE TABLE blood_inventory (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blood_type    blood_type NOT NULL UNIQUE,
  units_available INTEGER NOT NULL DEFAULT 0 CHECK (units_available >= 0),
  max_capacity  INTEGER NOT NULL DEFAULT 100,
  status        VARCHAR(20) GENERATED ALWAYS AS (
                  CASE
                    WHEN units_available = 0           THEN 'out'
                    WHEN units_available <= (max_capacity * 0.15) THEN 'critical'
                    WHEN units_available <= (max_capacity * 0.30) THEN 'low'
                    ELSE 'ok'
                  END
                ) STORED,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BLOOD REQUESTS ────────────────────────────────────────

CREATE TABLE blood_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_number  VARCHAR(20) UNIQUE NOT NULL,
  requester_id    UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  blood_type      blood_type NOT NULL,
  component       blood_component NOT NULL DEFAULT 'Whole Blood',
  units_requested INTEGER NOT NULL CHECK (units_requested > 0),
  urgency         urgency_level NOT NULL DEFAULT 'Normal',
  status          request_status NOT NULL DEFAULT 'pending',
  patient_name    VARCHAR(150),
  delivery_location TEXT,
  ward            VARCHAR(100),
  doctor_name     VARCHAR(150),
  contact_phone   VARCHAR(20),
  notes           TEXT,
  approved_at     TIMESTAMPTZ,
  dispatched_at   TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  cancel_reason   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── DONATION APPOINTMENTS ─────────────────────────────────

CREATE TABLE donation_appointments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  donation_number VARCHAR(20) UNIQUE NOT NULL,
  donor_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blood_type      blood_type NOT NULL,
  donation_type   blood_component NOT NULL DEFAULT 'Whole Blood',
  volume_ml       INTEGER DEFAULT 450,
  centre_name     VARCHAR(200) NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  health_notes    TEXT,
  status          donation_status NOT NULL DEFAULT 'scheduled',
  completed_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── EMERGENCY CONTACTS ────────────────────────────────────

CREATE TABLE emergency_contacts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(150) NOT NULL,
  relationship    VARCHAR(80) NOT NULL,
  phone           VARCHAR(20) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ACTIVITY / AUDIT LOG ──────────────────────────────────

CREATE TABLE activity_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(60),
  entity_id   UUID,
  description TEXT,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INDEXES ───────────────────────────────────────────────

CREATE INDEX idx_users_email          ON users(email);
CREATE INDEX idx_users_role           ON users(role);
CREATE INDEX idx_blood_requests_requester ON blood_requests(requester_id);
CREATE INDEX idx_blood_requests_status    ON blood_requests(status);
CREATE INDEX idx_blood_requests_created   ON blood_requests(created_at DESC);
CREATE INDEX idx_donations_donor      ON donation_appointments(donor_id);
CREATE INDEX idx_donations_date       ON donation_appointments(appointment_date);
CREATE INDEX idx_refresh_tokens_user  ON refresh_tokens(user_id);
CREATE INDEX idx_activity_user        ON activity_log(user_id);
CREATE INDEX idx_emergency_user       ON emergency_contacts(user_id);

-- ─── UPDATED_AT TRIGGER ────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_hospital_profiles_updated
  BEFORE UPDATE ON hospital_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_donor_profiles_updated
  BEFORE UPDATE ON donor_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_individual_profiles_updated
  BEFORE UPDATE ON individual_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_requests_updated
  BEFORE UPDATE ON blood_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_donations_updated
  BEFORE UPDATE ON donation_appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── SEED: BLOOD INVENTORY ─────────────────────────────────

INSERT INTO blood_inventory (blood_type, units_available, max_capacity) VALUES
  ('A+',  84,  120),
  ('A-',  12,   80),
  ('B+',  67,  100),
  ('B-',   5,   60),
  ('AB+', 31,   60),
  ('AB-',  8,   40),
  ('O+', 102,  150),
  ('O-',   3,   60)
ON CONFLICT (blood_type) DO UPDATE
  SET units_available = EXCLUDED.units_available,
      max_capacity    = EXCLUDED.max_capacity;

-- ─── SEED: DEMO USERS ──────────────────────────────────────
-- Passwords are all "password123" (bcrypt hash below)
-- Replace these hashes in production with real bcrypt hashes.

INSERT INTO users (id, name, email, password_hash, role, blood_type, phone, city, is_verified) VALUES
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Dr. Ramesh Verma',
    'admin@hospital.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'hospital',
    NULL,
    '+91 73100 11111',
    'Indore',
    TRUE
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000002',
    'Priya Mehta',
    'donor@gmail.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'donor',
    'B+',
    '+91 98765 43211',
    'Indore',
    TRUE
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000003',
    'Arjun Sharma',
    'user@gmail.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'individual',
    'O+',
    '+91 94251 00000',
    'Indore',
    TRUE
  )
ON CONFLICT (email) DO NOTHING;

-- Hospital profile seed
INSERT INTO hospital_profiles (user_id, org_name, authorized_person, hospital_type, bed_capacity)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'City General Hospital',
  'Dr. Ramesh Verma',
  'Government',
  500
) ON CONFLICT (user_id) DO NOTHING;

-- Donor profile seed
INSERT INTO donor_profiles (user_id, weight_kg, gender, date_of_birth, total_donations, streak, donor_level)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000002',
  58, 'Female', '2001-09-14', 7, 6, 'Gold'
) ON CONFLICT (user_id) DO NOTHING;

-- Individual profile seed
INSERT INTO individual_profiles (user_id, date_of_birth, gender, allergies)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000003',
  '1998-03-14', 'Male', 'Penicillin'
) ON CONFLICT (user_id) DO NOTHING;
