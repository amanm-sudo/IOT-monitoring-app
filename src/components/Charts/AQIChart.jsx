import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{
                background: 'rgba(10, 15, 28, 0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>{label}</p>
                {payload.map((entry, i) => (
                    <p key={i} style={{ fontSize: '0.85rem', color: entry.color, margin: '2px 0' }}>
                        {entry.name}: <strong>{entry.value?.toFixed(1)}</strong>
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export default function AQIChart({ history = [] }) {
    // Format history for chart: group by time, separate indoor/outdoor
    const chartData = [];
    const timeMap = {};

    history.forEach(r => {
        const time = new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (!timeMap[time]) {
            timeMap[time] = { time };
        }
        if (r.location === 'indoor') {
            timeMap[time].indoor = Number(r.final_aqi);
        } else if (r.location === 'outdoor') {
            timeMap[time].outdoor = Number(r.final_aqi);
        }
    });

    // Sort by time and take last 20 points
    const sortedData = Object.values(timeMap).slice(0, 20).reverse();

    // If no real data, generate demo data
    const data = sortedData.length > 3 ? sortedData : Array.from({ length: 12 }, (_, i) => ({
        time: `${(8 + i) % 24}:00`,
        indoor: 30 + Math.sin(i / 2) * 20 + Math.random() * 10,
        outdoor: 45 + Math.cos(i / 3) * 25 + Math.random() * 15
    }));

    return (
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0 }}>AQI TREND</h2>
                <span className="badge text-neon" style={{
                    background: 'rgba(0, 243, 255, 0.1)',
                    border: '1px solid var(--neon-cyan)'
                }}>INDOOR vs OUTDOOR</span>
            </div>

            <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                            dataKey="time"
                            stroke="var(--text-muted)"
                            fontSize={11}
                            tickLine={false}
                        />
                        <YAxis
                            stroke="var(--text-muted)"
                            fontSize={11}
                            tickLine={false}
                            domain={[0, 'auto']}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            wrapperStyle={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="indoor"
                            name="Indoor AQI"
                            stroke="var(--neon-cyan)"
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: 'var(--neon-cyan)' }}
                            activeDot={{ r: 5, fill: 'var(--neon-cyan)', filter: 'drop-shadow(0 0 6px var(--neon-cyan))' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="outdoor"
                            name="Outdoor AQI"
                            stroke="var(--neon-purple)"
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: 'var(--neon-purple)' }}
                            activeDot={{ r: 5, fill: 'var(--neon-purple)', filter: 'drop-shadow(0 0 6px var(--neon-purple))' }}
                            strokeDasharray="5 3"
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
