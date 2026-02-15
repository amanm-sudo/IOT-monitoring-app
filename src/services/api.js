import io from 'socket.io-client';

const API_URL = 'http://localhost:5000';
const socket = io(API_URL);

export const APIService = {
    // Socket instance for components to listen to
    socket,

    async getLatestData() {
        try {
            // For initial load, return mock data so charts appear immediately
            // Real data from socket will overwrite this
            return {
                temperature: {
                    value: (20 + Math.random() * 5).toFixed(1),
                    unit: '°C',
                    trend: Math.random() > 0.5 ? 'up' : 'down'
                },
                humidity: {
                    value: (40 + Math.random() * 20).toFixed(1),
                    unit: '%',
                    trend: Math.random() > 0.5 ? 'up' : 'down'
                },
                co2: {
                    value: Math.floor(400 + Math.random() * 200),
                    unit: 'ppm',
                    trend: Math.random() > 0.5 ? 'up' : 'down'
                },
                energy: {
                    value: (2.5 + Math.random() * 1.5).toFixed(2),
                    unit: 'kWh',
                    trend: Math.random() > 0.5 ? 'up' : 'down'
                }
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
            return await response.json();
        } catch (error) {
            console.error("Failed to fetch history", error);
            return [];
        }
    },

    // Mock predictions for now (AI engine would be on backend later)
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
        // Mock anomaly detection (can be moved to backend later)
        const isAnomaly = Math.random() > 0.95;
        return {
            detected: isAnomaly,
            score: Math.floor(Math.random() * 100),
            type: isAnomaly ? ['High Temp', 'Power Spike'][Math.floor(Math.random() * 2)] : null,
            severity: isAnomaly ? ['warning', 'critical'][Math.floor(Math.random() * 2)] : 'normal'
        };
    }
};
