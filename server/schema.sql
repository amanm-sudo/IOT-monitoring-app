-- Create Readings Table
CREATE TABLE IF NOT EXISTS sensor_readings (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL,
    temperature DECIMAL(5,2),
    humidity DECIMAL(5,2),
    co2_ppm INTEGER,
    energy_kwh DECIMAL(10,4),
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Optimize queries by time
CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON sensor_readings(timestamp DESC);

-- Example Insert (for testing)
-- INSERT INTO sensor_readings (device_id, temperature, humidity, co2_ppm, energy_kwh) VALUES ('ESP32_01', 25.5, 60.0, 412, 1.2);
