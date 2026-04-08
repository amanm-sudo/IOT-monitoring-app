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
