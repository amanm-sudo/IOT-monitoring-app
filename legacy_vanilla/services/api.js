export class APIService {
    static async getLatestData() {
        // Simulate network latency
        await new Promise(r => setTimeout(r, 200));

        // Generate realistic sensor values
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
    }

    static async getPredictions() {
        // Generate mock prediction arrays (next 10 points)
        return {
            temperature: Array.from({ length: 10 }, (_, i) => 22 + Math.sin(i / 2) + Math.random()),
            energy: Array.from({ length: 24 }, (_, i) => 2 + Math.cos(i / 3) + Math.random() * 0.5),
            confidence: Math.floor(85 + Math.random() * 10)
        };
    }

    static async getAnomalies() {
        const isAnomaly = Math.random() > 0.8; // 20% chance of anomaly
        return {
            detected: isAnomaly,
            score: Math.floor(Math.random() * 100),
            type: isAnomaly ? ['High Temp', 'Power Spike'][Math.floor(Math.random() * 2)] : null,
            severity: isAnomaly ? ['warning', 'critical'][Math.floor(Math.random() * 2)] : 'normal'
        };
    }
}
