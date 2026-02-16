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
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Socket.io Setup
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for now (dev mode)
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('Frontend connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('Frontend disconnected:', socket.id);
    });
});

// API Routes
app.get('/', (req, res) => {
    res.send('UGQ AI IoT Backend is Running');
});

// Get Historical Data
app.get('/api/sensors/history', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM sensor_readings ORDER BY timestamp DESC LIMIT 50');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Sensor Data Ingestion Endpoint (for ESP32)
app.post('/api/sensors/readings', async (req, res) => {
    const { device_id, temperature, humidity, co2_ppm, energy_kwh } = req.body;

    console.log('Received data:', req.body);

    try {
        // Save to DB
        const query = `
            INSERT INTO sensor_readings (device_id, temperature, humidity, co2_ppm, energy_kwh)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const result = await pool.query(query, [device_id, temperature, humidity, co2_ppm, energy_kwh]);


        // Emit to Frontend via WebSocket
        io.emit('new_reading', {
            device_id,
            temperature,
            humidity,
            co2_ppm,
            energy_kwh,
            timestamp: new Date()
        });

        res.status(201).json({ message: 'Data received', data: req.body });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // Listen on all network interfaces (not just localhost)

server.listen(PORT, HOST, () => {
    console.log(`Server running on ${HOST}:${PORT}`);
    console.log(`Access from laptop: http://localhost:${PORT}`);
    console.log(`Access from ESP32: http://10.10.16.194:${PORT}`);
});
