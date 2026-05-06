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

// Database Connection — fallback ensures connection even if Render env var panel fails
const DB_URL = process.env.DATABASE_URL ||
    'postgresql://neondb_owner:npg_JBplV4btz2Fa@ep-summer-tree-a1qoan7c-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

if (!process.env.DATABASE_URL) {
    console.warn('WARNING: DATABASE_URL env var not set — using hardcoded fallback connection string');
} else {
    console.log('DATABASE_URL is set, connecting to:', process.env.DATABASE_URL.split('@')[1] || 'unknown host');
}

const pool = new Pool({
    connectionString: DB_URL,
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
    res.send('UGQ IoT Backend — Energy Meter Monitor');
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
    const { device_id, energy_kwh, voltage, current } = req.body;

    console.log('Energy reading received:', { device_id, energy_kwh, voltage, current });

    try {
        const query = `
            INSERT INTO sensor_readings (device_id, energy_kwh, voltage, current)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const result = await pool.query(query, [device_id, energy_kwh || 0, voltage || 0, current || 0]);

        // Emit to Frontend via WebSocket
        io.emit('new_reading', {
            device_id,
            energy_kwh,
            voltage,
            current,
            timestamp: new Date()
        });

        res.status(201).json({ message: 'Energy data received', data: result.rows[0] });
    } catch (err) {
        console.error('Energy insert error:', err);
        res.status(500).json({ error: 'Server error', detail: err.message });
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

// ============================================
// DAILY ENERGY AGGREGATION (past 7 days)
// ============================================

// GET /api/sensors/energy/daily
// Returns last 7 calendar days (today included) with total energy_kwh per day
app.get('/api/sensors/energy/daily', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                DATE(timestamp AT TIME ZONE 'Asia/Kolkata') AS day,
                COALESCE(MAX(energy_kwh), 0)               AS total_energy
            FROM sensor_readings
            WHERE timestamp >= NOW() - INTERVAL '7 days'
            GROUP BY day
            ORDER BY day ASC
        `);

        const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Build a map of date-string -> total_energy from DB
        const dbMap = {};
        result.rows.forEach(r => {
            // r.day is a JS Date from pg
            const key = new Date(r.day).toISOString().slice(0, 10);
            dbMap[key] = parseFloat(r.total_energy) || 0;
        });

        // Generate last 7 days ending today
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            const isToday = i === 0;
            days.push({
                date: key,
                label: isToday ? 'TODAY' : DAY_NAMES[d.getDay()],
                energy: dbMap[key] ?? null,
                isToday,
            });
        }

        res.json(days);
    } catch (err) {
        console.error('Daily energy error:', err);
        res.status(500).json({ error: 'Server error', detail: err.message });
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
