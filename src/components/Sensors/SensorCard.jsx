import React from 'react';
import { Thermometer, Droplets, Wind, Zap, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

const ICONS = {
    temperature: { icon: Thermometer, color: 'var(--neon-red)' },
    humidity: { icon: Droplets, color: 'var(--neon-blue)' },
    co2: { icon: Wind, color: 'var(--neon-green)' },
    energy: { icon: Zap, color: 'var(--neon-purple)' },
    default: { icon: Activity, color: 'var(--text-primary)' }
};

export default function SensorCard({ title, data }) {
    const config = ICONS[title.toLowerCase()] || ICONS.default;
    const Icon = config.icon;
    const isUp = data.trend === 'up';

    // Generate dummy sparkline data
    const sparkData = Array.from({ length: 15 }, (_, i) => ({
        value: Math.random() * 10
    }));

    return (
        <div className="sensor-card glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', overflow: 'hidden' }}>
            <div className="card-header" style={{ marginBottom: 0 }}>
                <span className="sensor-title" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>{title}</span>
                <Icon size={20} style={{ color: config.color, filter: `drop-shadow(0 0 8px ${config.color})` }} />
            </div>

            <div className="sensor-value-container" style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span className="sensor-value" style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{data.value}</span>
                <span className="sensor-unit" style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>{data.unit}</span>
            </div>

            <div className="trend-indicator" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                <span style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    color: isUp ? 'var(--status-warning)' : 'var(--neon-cyan)',
                    background: isUp ? 'rgba(255, 191, 0, 0.1)' : 'rgba(0, 243, 255, 0.1)',
                    padding: '2px 8px', borderRadius: '4px', border: `1px solid ${isUp ? 'rgba(255, 191, 0, 0.2)' : 'rgba(0, 243, 255, 0.2)'}`
                }}>
                    {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {isUp ? '+2.4%' : '-1.2%'}
                </span>
                <span className="sensor-unit" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>vs last hr</span>
            </div>

            <div style={{ height: 60, marginTop: 'auto', marginBottom: '-10px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sparkData}>
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke={config.color}
                            strokeWidth={2}
                            dot={false}
                            check={{ r: 4, fill: config.color }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Decorative Glow */}
            <div style={{
                position: 'absolute', top: '-50%', right: '-50%', width: '100%', height: '100%',
                background: `radial-gradient(circle, ${config.color} 0%, transparent 70%)`,
                opacity: 0.1, pointerEvents: 'none', filter: 'blur(40px)'
            }} />
        </div>
    );
}
