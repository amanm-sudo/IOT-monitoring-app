const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

const sql = `
CREATE TABLE IF NOT EXISTS user_profiles (
    id          UUID PRIMARY KEY,
    email       TEXT NOT NULL UNIQUE,
    name        TEXT,
    dob         DATE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comfort_surveys (
    id              SERIAL PRIMARY KEY,
    user_id         UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    activity_level  TEXT,
    clothing_level  TEXT,
    thermal_pref    TEXT,
    air_movement    TEXT,
    humidity_pref   TEXT,
    room_temp       DECIMAL(5,2),
    room_humidity   DECIMAL(5,2),
    room_co2        INTEGER,
    comfort_level   INTEGER,
    comfort_label   TEXT,
    submitted_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surveys_user      ON comfort_surveys(user_id);
CREATE INDEX IF NOT EXISTS idx_surveys_submitted ON comfort_surveys(submitted_at DESC);
`;

pool.query(sql)
    .then(() => { console.log('✅  Tables created / verified OK'); })
    .catch(e => { console.error('❌  Error:', e.message); })
    .finally(() => pool.end());
