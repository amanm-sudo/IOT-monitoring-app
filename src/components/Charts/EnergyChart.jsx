import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Zap } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="glass-panel" style={{ padding: '12px', borderColor: 'var(--neon-green)', boxShadow: '0 0 15px rgba(10, 255, 104, 0.2)' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>Hour: {label}</p>
                <p style={{ color: 'var(--neon-green)', fontSize: '0.9rem', fontWeight: 600 }}>
                    {payload[0].value.toFixed(2)} kWh
                </p>
            </div>
        );
    }
    return null;
};

export default function EnergyChart({ predictions }) {
    // Transform prediction data (array of 24 hours) into chart format
    const data = useMemo(() => {
        if (!predictions || !predictions.energy) return [];

        const currentHour = new Date().getHours();
        return predictions.energy.map((val, i) => ({
            name: `${(currentHour + i) % 24}:00`,
            uv: val
        })).slice(0, 12); // Show next 12 hours
    }, [predictions]);

    return (
        <div className="chart-card glass-panel" style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Zap size={18} color="var(--neon-green)" />
                    ENERGY CONSUMPTION (FORECAST)
                </h3>
            </div>
            <div className="chart-container" style={{ flex: 1, minHeight: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                        <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                        <Bar
                            dataKey="uv"
                            fill="var(--neon-green)"
                            radius={[4, 4, 0, 0]}
                            fillOpacity={0.6}
                            activeBar={{ fill: 'var(--neon-green)', fillOpacity: 0.8 }}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
