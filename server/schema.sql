-- ============================================================
--  Sensor Readings Table (Energy Meter — Outdoor Unit)
-- ============================================================
CREATE TABLE IF NOT EXISTS sensor_readings (
    id          SERIAL PRIMARY KEY,
    device_id   VARCHAR(50) NOT NULL,
    energy_kwh  DECIMAL(10,4),
    voltage     DECIMAL(8,2),
    current     DECIMAL(8,4),
    timestamp   TIMESTAMPTZ DEFAULT NOW()
);

-- Drop legacy AQI columns if they exist (safe no-op if already absent)
ALTER TABLE sensor_readings DROP COLUMN IF EXISTS temperature;
ALTER TABLE sensor_readings DROP COLUMN IF EXISTS humidity;
ALTER TABLE sensor_readings DROP COLUMN IF EXISTS co2_ppm;

-- ADD the energy meter columns if they don't exist yet (idempotent)
ALTER TABLE sensor_readings ADD COLUMN IF NOT EXISTS energy_kwh DECIMAL(10,4);
ALTER TABLE sensor_readings ADD COLUMN IF NOT EXISTS voltage    DECIMAL(8,2);
ALTER TABLE sensor_readings ADD COLUMN IF NOT EXISTS current    DECIMAL(8,4);

-- Optimize queries by time
CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON sensor_readings(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_readings_device    ON sensor_readings(device_id);

-- ============================================================
--  AQI Readings Table (Indoor Unit)
-- ============================================================
CREATE TABLE IF NOT EXISTS aqi_readings (
    id             SERIAL PRIMARY KEY,
    device_id      VARCHAR(50) NOT NULL,
    location       VARCHAR(20) NOT NULL,
    pm1_0          DECIMAL(8,2),
    pm2_5          DECIMAL(8,2),
    pm4_0          DECIMAL(8,2),
    pm10           DECIMAL(8,2),
    co2            INTEGER,
    tvoc           DECIMAL(8,2),
    voc_index      DECIMAL(8,2),
    nox_index      DECIMAL(8,2),
    temperature    DECIMAL(5,2),
    humidity       DECIMAL(5,2),
    aqi_pm25       DECIMAL(8,2),
    aqi_pm10       DECIMAL(8,2),
    aqi_co2        DECIMAL(8,2),
    aqi_tvoc       DECIMAL(8,2),
    final_aqi      DECIMAL(8,2),
    window_status  VARCHAR(10) DEFAULT 'closed',
    timestamp      TIMESTAMPTZ DEFAULT NOW()
);

-- Optimize AQI queries
CREATE INDEX IF NOT EXISTS idx_aqi_timestamp ON aqi_readings(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_aqi_device    ON aqi_readings(device_id);
CREATE INDEX IF NOT EXISTS idx_aqi_location  ON aqi_readings(location);

-- ============================================================
--  USER PROFILES (mirrors Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id          UUID PRIMARY KEY,      -- matches supabase auth.users.id
    email       TEXT NOT NULL UNIQUE,
    name        TEXT,
    dob         DATE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
--  COMFORT SURVEYS (questionnaire results)
-- ============================================================
CREATE TABLE IF NOT EXISTS comfort_surveys (
    id              SERIAL PRIMARY KEY,
    user_id         UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    -- Questionnaire answers
    activity_level  TEXT,              -- 'resting','standing','walking','exercise'
    clothing_level  TEXT,              -- 'minimal','light','medium','heavy'
    thermal_pref    TEXT,              -- ASHRAE scale value as string (-3 to +3)
    air_movement    TEXT,              -- 'still','slight','moderate','strong'
    humidity_pref   TEXT,              -- 'dry','comfortable','humid'
    -- Room snapshot at time of survey
    room_temp       DECIMAL(5,2),
    room_humidity   DECIMAL(5,2),
    room_co2        INTEGER,
    -- ML output
    comfort_level   INTEGER,           -- 0=Cold, 1=Slightly Cool, 2=Slightly Warm, 3=Hot
    comfort_label   TEXT,
    submitted_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surveys_user      ON comfort_surveys(user_id);
CREATE INDEX IF NOT EXISTS idx_surveys_submitted ON comfort_surveys(submitted_at DESC);

