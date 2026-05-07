const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const axios = require('axios');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// ── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Database ─────────────────────────────────────────────────
const DB_URL = process.env.DATABASE_URL ||
    'postgresql://neondb_owner:npg_JBplV4btz2Fa@ep-summer-tree-a1qoan7c-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

if (!process.env.DATABASE_URL) {
    console.warn('WARNING: DATABASE_URL env var not set — using hardcoded fallback');
} else {
    console.log('DATABASE_URL set → host:', process.env.DATABASE_URL.split('@')[1]?.split('/')[0] || 'unknown');
}

const pool = new Pool({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 10,
});

pool.connect((err, client, release) => {
    if (err) console.error('DB CONNECTION FAILED:', err.message);
    else { console.log('DB connected!'); release(); }
});

// ── Supabase (admin / service-role) ─────────────────────────
const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_KEY || '',
);

// ── Nodemailer (Gmail App Password) ─────────────────────────
const mailer = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.GMAIL_USER || '',
        // Strip dashes — Google accepts both formats (with or without)
        pass: (process.env.GMAIL_APP_PASS || '').replace(/-/g, ''),
    },
});


async function sendMail({ to, subject, html }) {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASS) {
        console.warn('[Mailer] GMAIL_USER / GMAIL_APP_PASS not set — skipping email');
        return;
    }
    try {
        await mailer.sendMail({ from: `"IoT Monitor 🌡️" <${process.env.GMAIL_USER}>`, to, subject, html });
        console.log(`[Mailer] Sent "${subject}" → ${to}`);
    } catch (err) {
        console.error('[Mailer] Failed:', err.message);
    }
}

// ── ML Model ─────────────────────────────────────────────────
const ML_URL = process.env.ML_MODEL_URL || 'http://localhost:8000/predict';

// ── Socket.io ────────────────────────────────────────────────
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });
io.on('connection', (socket) => {
    console.log('Frontend connected:', socket.id);
    socket.on('disconnect', () => console.log('Frontend disconnected:', socket.id));
});

// ═══════════════════════════════════════════════════════════════
//  AUTH MIDDLEWARE — verifies Supabase JWT
// ═══════════════════════════════════════════════════════════════
async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const { data, error } = await supabase.auth.getUser(token);
        if (error || !data?.user) return res.status(401).json({ error: 'Invalid or expired token' });
        req.user = data.user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Auth check failed' });
    }
}

// ═══════════════════════════════════════════════════════════════
//  GENERAL ROUTES
// ═══════════════════════════════════════════════════════════════
app.get('/', (req, res) => res.send('UGQ IoT Backend — Energy Meter Monitor'));

app.get('/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() as time, current_database() as db');
        res.json({ status: 'ok', db: 'connected', database: result.rows[0].db, time: result.rows[0].time });
    } catch (err) {
        res.status(500).json({ status: 'error', db: 'failed', error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/auth/register
 * Called by frontend after Supabase signUp succeeds.
 * Creates profile row in Neon + sends welcome email.
 */
app.post('/api/auth/register', async (req, res) => {
    const { userId, email, name } = req.body;
    if (!userId || !email) return res.status(400).json({ error: 'userId and email required' });

    try {
        await pool.query(
            `INSERT INTO user_profiles (id, email, name)
             VALUES ($1, $2, $3)
             ON CONFLICT (id) DO NOTHING`,
            [userId, email, name || null],
        );

        // Welcome email
        await sendMail({
            to: email,
            subject: '👋 Welcome to IoT Monitor!',
            html: `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0f1117;color:#e5e7eb;padding:32px;border-radius:12px;">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">
    <span style="font-size:24px;">⚡</span>
    <span style="font-size:18px;font-weight:700;color:#2dd4bf;">IoT Monitor</span>
  </div>
  <h1 style="font-size:22px;margin:0 0 12px;">Welcome${name ? ', ' + name : ''}!</h1>
  <p style="color:#9ca3af;line-height:1.6;margin-bottom:20px;">
    Your account is ready. You can now monitor your environment in real-time, 
    take thermal comfort surveys, and get ML-powered HVAC recommendations.
  </p>
  <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}"
     style="display:inline-block;padding:11px 24px;background:#2dd4bf;color:#003732;
            font-weight:700;border-radius:6px;text-decoration:none;">
    Open Dashboard →
  </a>
  <p style="margin-top:28px;font-size:12px;color:#6b7280;">
    If you didn't create this account, ignore this email.
  </p>
</div>`,
        });

        res.json({ message: 'Profile created' });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
//  PROFILE ROUTES
// ═══════════════════════════════════════════════════════════════

/** GET /api/profile — returns user's profile row */
app.get('/api/profile', requireAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM user_profiles WHERE id = $1', [req.user.id]
        );
        if (!rows.length) {
            // Auto-create if missing (e.g., user created directly via Supabase dashboard)
            await pool.query(
                `INSERT INTO user_profiles (id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [req.user.id, req.user.email],
            );
            return res.json({ id: req.user.id, email: req.user.email, name: null, dob: null });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/** PUT /api/profile — update name + DOB */
app.put('/api/profile', requireAuth, async (req, res) => {
    const { name, dob } = req.body;
    try {
        const { rows } = await pool.query(
            `UPDATE user_profiles
             SET name = $1, dob = $2, updated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [name || null, dob || null, req.user.id],
        );
        if (!rows.length) return res.status(404).json({ error: 'Profile not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
//  SURVEY / QUESTIONNAIRE ROUTES
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/survey/submit
 * 1. Reads latest indoor sensor data for context
 * 2. Forwards answers + sensor context to ML model
 * 3. Stores result in comfort_surveys
 * 4. Sends alert email if comfort_level is 0 or 3
 */

// Pre-warm ML server (call from frontend when survey page loads)
app.get('/api/ml/warm', (_req, res) => {
    const baseUrl = ML_URL.replace('/predict', '');
    axios.get(`${baseUrl}/health`, { timeout: 10000 }).catch(() => { });
    res.json({ status: 'warming' });
});

app.post('/api/survey/submit', requireAuth, async (req, res) => {
    const {
        gender, activity, clothing, air_movement,
        // These 3 were removed from the frontend survey — use sensible defaults
        thermal_sensation = 0,          // neutral
        humidity_pref     = 'comfortable',
        ventilation_pref  = 'same',
    } = req.body;

    // ── Get latest sensor context (best-effort) ──────────────
    let roomTemp = 25, roomHumidity = 50, roomCo2 = 600;
    try {
        const sensorRes = await pool.query(`
            SELECT temperature, humidity, co2 FROM aqi_readings
            WHERE location = 'indoor'
            ORDER BY timestamp DESC LIMIT 1
        `);
        if (sensorRes.rows.length) {
            roomTemp = parseFloat(sensorRes.rows[0].temperature) || 25;
            roomHumidity = parseFloat(sensorRes.rows[0].humidity) || 50;
            roomCo2 = parseInt(sensorRes.rows[0].co2) || 600;
        }
    } catch { /* no sensor data, use defaults */ }

    // ── Call ML model ────────────────────────────────────────
    let comfortLevel = 1, comfortLabel = 'Slightly Cool / Neutral', action = 'Environment is within acceptable comfort range.', modelNote = null;
    try {
        const mlPayload = {
            gender, thermal_sensation, activity, clothing,
            air_movement, humidity_pref, ventilation_pref,
            temperature: roomTemp, humidity: roomHumidity, co2: roomCo2,
        };
        // 10s timeout: if ML server is warm (from pre-warm ping), it responds in <1s.
        // If cold, fall back to heuristic immediately — no point making user wait.
        const mlRes = await axios.post(ML_URL, mlPayload, { timeout: 10000 });
        comfortLevel = parseInt(mlRes.data.comfort_level ?? 1);
        comfortLabel = mlRes.data.label || comfortLabel;
        action = mlRes.data.action || action;
        modelNote = mlRes.data.note || null;
        console.log(`[ML] ✅ ML model responded: level=${comfortLevel} label=${comfortLabel}`);
    } catch (err) {
        console.warn('[ML] Model call failed:', err.message, '— using fallback heuristic');
        // Fallback: simple rule based on thermal_sensation
        const ts = Number(thermal_sensation ?? 0);
        if (ts <= -1.5) { comfortLevel = 0; comfortLabel = 'Cold'; action = 'Consider increasing room temperature or reducing ventilation.'; }
        else if (ts >= 1.5) { comfortLevel = 3; comfortLabel = 'Hot'; action = 'Consider lowering room temperature or increasing ventilation.'; }
        else if (ts < 0) { comfortLevel = 1; comfortLabel = 'Slightly Cool / Neutral'; }
        else { comfortLevel = 2; comfortLabel = 'Slightly Warm / Neutral'; }
        modelNote = 'ML server unavailable — result based on heuristic fallback.';
    }

    // ── Store in DB ──────────────────────────────────────────
    try {
        await pool.query(
            `INSERT INTO comfort_surveys
             (user_id, activity_level, clothing_level, thermal_pref, air_movement, humidity_pref,
              room_temp, room_humidity, room_co2, comfort_level, comfort_label)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [req.user.id, activity, clothing, thermal_sensation?.toString(), air_movement, humidity_pref,
                roomTemp, roomHumidity, roomCo2, comfortLevel, comfortLabel],
        );
    } catch (dbErr) {
        console.error('[Survey] DB insert error:', dbErr.message);
    }

    // ── Alert email for extreme comfort levels ────────────────
    const isExtreme = comfortLevel === 0 || comfortLevel === 3;
    if (isExtreme) {
        const emoji = comfortLevel === 0 ? '❄️' : '🔥';
        const tempWord = comfortLevel === 0 ? 'too cold' : 'too hot';
        const userEmail = req.user.email;
        await sendMail({
            to: userEmail,
            subject: `${emoji} Thermal Comfort Alert — Your space may be ${tempWord}`,
            html: `
<div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0f1117;color:#e5e7eb;padding:32px;border-radius:12px;">
  <div style="margin-bottom:20px;">
    <span style="font-size:32px;">${emoji}</span>
    <span style="font-size:18px;font-weight:700;color:#2dd4bf;margin-left:10px;">IoT Monitor — Comfort Alert</span>
  </div>
  <h1 style="font-size:20px;margin:0 0 12px;">Comfort Level: ${comfortLabel}</h1>
  <p style="color:#9ca3af;line-height:1.6;margin-bottom:16px;">${action}</p>
  <div style="background:#161b27;border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:16px;margin-bottom:20px;">
    <p style="margin:0;font-size:13px;color:#9ca3af;">Current room conditions at time of survey:</p>
    <p style="margin:8px 0 0;font-size:14px;">🌡️ Temperature: <strong>${roomTemp}°C</strong></p>
    <p style="margin:4px 0 0;font-size:14px;">💧 Humidity: <strong>${roomHumidity}%</strong></p>
    <p style="margin:4px 0 0;font-size:14px;">💨 CO₂: <strong>${roomCo2} ppm</strong></p>
  </div>
  <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}"
     style="display:inline-block;padding:11px 24px;background:#2dd4bf;color:#003732;
            font-weight:700;border-radius:6px;text-decoration:none;">
    View Dashboard →
  </a>
</div>`,
        });
    }

    res.json({
        comfort_level: comfortLevel,
        label: comfortLabel,
        action,
        note: modelNote,
        room_context: { temperature: roomTemp, humidity: roomHumidity, co2: roomCo2 },
    });
});

/** GET /api/survey/history — last 20 surveys for logged-in user */
app.get('/api/survey/history', requireAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT * FROM comfort_surveys
             WHERE user_id = $1
             ORDER BY submitted_at DESC
             LIMIT 20`,
            [req.user.id],
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
//  ENERGY METER ENDPOINTS (existing — unchanged)
// ═══════════════════════════════════════════════════════════════

app.get('/api/sensors/history', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM sensor_readings ORDER BY timestamp DESC LIMIT 50');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/sensors/readings', async (req, res) => {
    const { device_id, energy_kwh, voltage, current } = req.body;
    console.log('Energy reading:', { device_id, energy_kwh, voltage, current });
    try {
        const result = await pool.query(
            `INSERT INTO sensor_readings (device_id, energy_kwh, voltage, current)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [device_id, energy_kwh || 0, voltage || 0, current || 0],
        );
        io.emit('new_reading', { device_id, energy_kwh, voltage, current, timestamp: new Date() });
        res.status(201).json({ message: 'Energy data received', data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Server error', detail: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
//  AQI ENDPOINTS (existing — unchanged)
// ═══════════════════════════════════════════════════════════════

app.post('/api/sensors/aqi', async (req, res) => {
    const {
        device_id, location,
        pm1_0, pm2_5, pm4_0, pm10,
        co2, tvoc, voc_index, nox_index,
        temperature, humidity,
        aqi_pm25, aqi_pm10, aqi_co2, aqi_tvoc,
        final_aqi, window_status,
    } = req.body;
    console.log(`AQI reading [${location}]:`, req.body);
    try {
        await pool.query(
            `INSERT INTO aqi_readings (
                device_id, location, pm1_0, pm2_5, pm4_0, pm10,
                co2, tvoc, voc_index, nox_index, temperature, humidity,
                aqi_pm25, aqi_pm10, aqi_co2, aqi_tvoc, final_aqi, window_status
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
            [device_id, location || 'unknown', pm1_0, pm2_5, pm4_0, pm10,
                co2, tvoc, voc_index, nox_index, temperature, humidity,
                aqi_pm25, aqi_pm10, aqi_co2, aqi_tvoc, final_aqi, window_status || 'closed'],
        );
        io.emit('new_aqi_reading', { ...req.body, timestamp: new Date() });
        res.status(201).json({ message: 'AQI data received' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/sensors/aqi/latest', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT DISTINCT ON (location) * FROM aqi_readings ORDER BY location, timestamp DESC`
        );
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/sensors/aqi/history', async (req, res) => {
    try {
        const { location } = req.query;
        let query = 'SELECT * FROM aqi_readings';
        const params = [];
        if (location) { query += ' WHERE location = $1'; params.push(location); }
        query += ' ORDER BY timestamp DESC LIMIT 100';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// ═══════════════════════════════════════════════════════════════
//  DAILY ENERGY (existing — unchanged)
// ═══════════════════════════════════════════════════════════════

app.get('/api/sensors/energy/daily', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DATE(timestamp AT TIME ZONE 'Asia/Kolkata') AS day,
                   COALESCE(MAX(energy_kwh), 0) AS total_energy
            FROM sensor_readings
            WHERE timestamp >= NOW() - INTERVAL '7 days'
            GROUP BY day ORDER BY day ASC
        `);
        const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const dbMap = {};
        result.rows.forEach(r => {
            const key = new Date(r.day).toISOString().slice(0, 10);
            dbMap[key] = parseFloat(r.total_energy) || 0;
        });
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today); d.setDate(today.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            days.push({ date: key, label: i === 0 ? 'TODAY' : DAY_NAMES[d.getDay()], energy: dbMap[key] ?? null, isToday: i === 0 });
        }
        res.json(days);
    } catch (err) { res.status(500).json({ error: 'Server error', detail: err.message }); }
});

// ── Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
