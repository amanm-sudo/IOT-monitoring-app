import io from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'https://iot-monitoring-app-5xoi.onrender.com';
const socket = io(API_URL);

export const APIService = {
    socket,

    // Returns the single most-recent energy meter row from the DB
    async getLatestData() {
        try {
            const response = await fetch(`${API_URL}/api/sensors/history?limit=1`);
            if (!response.ok) throw new Error('Failed to fetch latest');
            const rows = await response.json();
            if (!rows || rows.length === 0) return null;
            const r = rows[0];
            return {
                temperature: { value: parseFloat(r.temperature) || 0,  unit: '°C',  trend: 'flat' },
                humidity:    { value: parseFloat(r.humidity)    || 0,  unit: '%',   trend: 'flat' },
                co2:         { value: parseInt(r.co2_ppm)       || 0,  unit: 'ppm', trend: 'flat' },
                energy:      { value: parseFloat(r.energy_kwh)  || 0,  unit: 'kWh', trend: 'flat' },
                voltage:     { value: parseFloat(r.voltage)     || 0,  unit: 'V',   trend: 'flat' },
                current:     { value: parseFloat(r.current)     || 0,  unit: 'A',   trend: 'flat' }
            };
        } catch (error) {
            console.error("Failed to fetch latest data", error);
            return null;
        }
    },

    async getHistory() {
        try {
            const response = await fetch(`${API_URL}/api/sensors/history`);
            if (!response.ok) throw new Error('Network response was not ok');
            const rows = await response.json();
            // Sort newest-first just in case
            return Array.isArray(rows) ? rows.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) : [];
        } catch (error) {
            console.error("Failed to fetch history", error);
            return [];
        }
    },

    // AQI Endpoints
    async getAQILatest() {
        try {
            const response = await fetch(`${API_URL}/api/sensors/aqi/latest`);
            if (!response.ok) throw new Error('AQI latest failed');
            const rows = await response.json();
            // Return { indoor: {...}, outdoor: {...} }
            const result = {};
            rows.forEach(r => {
                result[r.location] = r;
            });
            return result;
        } catch (error) {
            console.error("Failed to fetch AQI latest", error);
            // Return mock data for testing
            return {
                indoor: {
                    device_id: 'MOCK_INDOOR',
                    location: 'indoor',
                    pm1_0: 5.2, pm2_5: 12.3, pm4_0: 15.1, pm10: 18.5,
                    co2: 650, tvoc: 120, voc_index: 180, nox_index: 10,
                    temperature: 25.3, humidity: 55.0,
                    aqi_pm25: 45, aqi_pm10: 30, aqi_co2: 55, aqi_tvoc: 20,
                    final_aqi: 55, window_status: 'open',
                    timestamp: new Date().toISOString()
                },
                outdoor: {
                    device_id: 'MOCK_OUTDOOR',
                    location: 'outdoor',
                    pm1_0: 8.1, pm2_5: 22.5, pm4_0: 28.3, pm10: 35.7,
                    co2: 420, tvoc: 85, voc_index: 120, nox_index: 15,
                    temperature: 30.1, humidity: 45.0,
                    aqi_pm25: 65, aqi_pm10: 42, aqi_co2: 10, aqi_tvoc: 15,
                    final_aqi: 65, window_status: 'N/A',
                    timestamp: new Date().toISOString()
                }
            };
        }
    },

    async getAQIHistory() {
        try {
            const response = await fetch(`${API_URL}/api/sensors/aqi/history`);
            if (!response.ok) throw new Error('AQI history failed');
            return await response.json();
        } catch (error) {
            console.error("Failed to fetch AQI history", error);
            return [];
        }
    },

    // Daily energy consumption for past 7 days
    async getDailyEnergy() {
        try {
            const response = await fetch(`${API_URL}/api/sensors/energy/daily`);
            if (!response.ok) throw new Error('Daily energy failed');
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch daily energy', error);
            return null; // caller will use fallback
        }
    },

    // Mock predictions
    async getPredictions() {
        return {
            temperature: Array.from({ length: 10 }, (_, i) => 22 + Math.sin(i / 2) + Math.random()),
            humidity: Array.from({ length: 10 }, (_, i) => 45 + Math.cos(i / 2) * 5 + Math.random() * 2),
            co2: Array.from({ length: 10 }, (_, i) => 400 + Math.sin(i / 3) * 50 + Math.random() * 20),
            energy: Array.from({ length: 24 }, (_, i) => 2 + Math.cos(i / 3) + Math.random() * 0.5),
            confidence: Math.floor(85 + Math.random() * 10)
        };
    },

    async getAnomalies() {
        const isAnomaly = Math.random() > 0.95;
        return {
            detected: isAnomaly,
            score: Math.floor(Math.random() * 100),
            type: isAnomaly ? ['High Temp', 'Power Spike'][Math.floor(Math.random() * 2)] : null,
            severity: isAnomaly ? ['warning', 'critical'][Math.floor(Math.random() * 2)] : 'normal'
        };
    }
};
