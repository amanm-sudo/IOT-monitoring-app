const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
if (!process.env.DATABASE_URL) {
    console.error('FATAL: DATABASE_URL environment variable is not set!');
} else {
    console.log('DATABASE_URL is set, connecting to:', process.env.DATABASE_URL.split('@')[1] || 'unknown host');
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 10
});

// Test DB connection on startup
pool.connect((err, client, release) => {
    if (err) {
        console.error('DB CONNECTION FAILED:', err.message);
        console.error('Error code:', err.code);
    } else {
        console.log('DB connected successfully!');
        release();
    }
});

// Socket.io Setup
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('Frontend connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('Frontend disconnected:', socket.id);
    });
});

// ============================================
// API Routes
// ============================================

app.get('/', (req, res) => {
    res.send('UGQ AI IoT Backend is Running — Energy + AQI');
});

// Health check — shows DB connectivity status
app.get('/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() as time, current_database() as db');
        res.json({
            status: 'ok',
            db: 'connected',
            database: result.rows[0].db,
            time: result.rows[0].time,
            env_set: !!process.env.DATABASE_URL
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            db: 'failed',
            error: err.message,
            code: err.code,
            env_set: !!process.env.DATABASE_URL
        });
    }
});

// ============================================
// ENERGY METER ENDPOINTS (existing)
// ============================================

// Get Historical Energy Data
app.get('/api/sensors/history', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM sensor_readings ORDER BY timestamp DESC LIMIT 50');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Energy Sensor Data Ingestion (for ESP32 Energy Meter)
app.post('/api/sensors/readings', async (req, res) => {
    const { device_id, temperature, humidity, co2_ppm, energy_kwh, voltage, current } = req.body;

    console.log('Energy reading received:', req.body);

    try {
        const query = `
            INSERT INTO sensor_readings (device_id, temperature, humidity, co2_ppm, energy_kwh, voltage, current)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;
        const result = await pool.query(query, [device_id, temperature, humidity, co2_ppm, energy_kwh, voltage || 0, current || 0]);

        // Emit to Frontend via WebSocket
        io.emit('new_reading', {
            device_id,
            temperature,
            humidity,
            co2_ppm,
            energy_kwh,
            voltage,
            current,
            timestamp: new Date()
        });

        res.status(201).json({ message: 'Energy data received', data: req.body });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// AQI ENDPOINTS (new)
// ============================================

// AQI Data Ingestion (for Indoor/Outdoor ESP32s)
app.post('/api/sensors/aqi', async (req, res) => {
    const {
        device_id, location,
        pm1_0, pm2_5, pm4_0, pm10,
        co2, tvoc, voc_index, nox_index,
        temperature, humidity,
        aqi_pm25, aqi_pm10, aqi_co2, aqi_tvoc,
        final_aqi, window_status
    } = req.body;

    console.log(`AQI reading [${location}]:`, req.body);

    try {
        const query = `
            INSERT INTO aqi_readings (
                device_id, location,
                pm1_0, pm2_5, pm4_0, pm10,
                co2, tvoc, voc_index, nox_index,
                temperature, humidity,
                aqi_pm25, aqi_pm10, aqi_co2, aqi_tvoc,
                final_aqi, window_status
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
            RETURNING *;
        `;
        await pool.query(query, [
            device_id, location || 'unknown',
            pm1_0, pm2_5, pm4_0, pm10,
            co2, tvoc, voc_index, nox_index,
            temperature, humidity,
            aqi_pm25, aqi_pm10, aqi_co2, aqi_tvoc,
            final_aqi, window_status || 'closed'
        ]);

        // Emit to Frontend via WebSocket
        io.emit('new_aqi_reading', {
            device_id, location,
            pm1_0, pm2_5, pm4_0, pm10,
            co2, tvoc, voc_index, nox_index,
            temperature, humidity,
            aqi_pm25, aqi_pm10, aqi_co2, aqi_tvoc,
            final_aqi, window_status,
            timestamp: new Date()
        });

        res.status(201).json({ message: 'AQI data received', data: req.body });
    } catch (err) {
        console.error('AQI insert error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Latest AQI (one per location)
app.get('/api/sensors/aqi/latest', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT ON (location) *
            FROM aqi_readings
            ORDER BY location, timestamp DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get AQI History (filterable by location)
app.get('/api/sensors/aqi/history', async (req, res) => {
    try {
        const { location } = req.query;
        let query = 'SELECT * FROM aqi_readings';
        const params = [];

        if (location) {
            query += ' WHERE location = $1';
            params.push(location);
        }

        query += ' ORDER BY timestamp DESC LIMIT 100';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log(`Server running on ${HOST}:${PORT}`);
    console.log(`Access from laptop: http://localhost:${PORT}`);
});
