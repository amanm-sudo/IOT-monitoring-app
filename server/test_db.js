const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function testInsert() {
    try {
        const query = `
            INSERT INTO sensor_readings (device_id, temperature, humidity, co2_ppm, energy_kwh)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const result = await pool.query(query, ['ESP32_MAIN_01', 0, 0, 0, 0]);
        console.log('SUCCESS:', result.rows);
    } catch (err) {
        console.error('ERROR INSERTING:', err.message);
    } finally {
        await pool.end();
    }
}
testInsert();
