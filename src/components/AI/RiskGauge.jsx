import React from 'react';

export default function RiskGauge({ score, data }) {
    // Determine risk level properties
    const getRiskLevel = (s) => {
        if (s < 30) return { label: 'OPTIMAL', color: 'var(--neon-green)', glow: 'rgba(10, 255, 104, 0.4)' };
        if (s < 70) return { label: 'MODERATE', color: 'var(--status-warning)', glow: 'rgba(255, 191, 0, 0.4)' };
        return { label: 'CRITICAL', color: 'var(--neon-red)', glow: 'rgba(255, 0, 85, 0.4)' };
    };

    const { label, color, glow } = getRiskLevel(score);

    // SVG Gauge Calculations
    const radius = 80;
    const stroke = 15;
    const normalizedScore = Math.min(Math.max(score, 0), 100);
    const circumference = normalizedScore * 1.8; // 180 degrees max

    return (
        <div className="glass-panel" style={{
            padding: '1.5rem',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', letterSpacing: '1px' }}>ENV INDEX</h3>
                <span className="badge" style={{
                    backgroundColor: `rgba(${color === 'var(--neon-green)' ? '10, 255, 104' : '255, 0, 85'}, 0.1)`,
                    color: color,
                    border: `1px solid ${color}`
                }}>
                    {label}
                </span>
            </div>

            {/* Main Gauge Area */}
            <div style={{ position: 'relative', height: '140px', display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
                {/* SVG Gauge */}
                <svg width="200" height="110" viewBox="0 0 200 110" style={{ overflow: 'visible' }}>
                    {/* Background Arc */}
                    <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} strokeLinecap="round" />

                    {/* Value Arc (using stroke-dasharray for progress) */}
                    <path
                        d="M 20 100 A 80 80 0 0 1 180 100"
                        fill="none"
                        stroke={color}
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray="251.2" // Full semi-circle length (approx PI * 80)
                        strokeDashoffset={251.2 - (2.512 * normalizedScore)}
                        style={{
                            transition: 'stroke-dashoffset 1s ease-out, stroke 0.5s ease',
                            filter: `drop-shadow(0 0 8px ${glow})`
                        }}
                    />
                </svg>

                {/* Score Text */}
                <div style={{ position: 'absolute', bottom: '0', textAlign: 'center' }}>
                    <div className="text-neon" style={{
                        fontSize: '2.5rem',
                        fontWeight: '700',
                        lineHeight: 1,
                        textShadow: `0 0 20px ${glow}`
                    }}>
                        {score}
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '5px' }}>RISK SCORE</div>
                </div>
            </div>

            {/* Environmental Details */}
            {data && (
                <div style={{
                    marginTop: '1.5rem',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '1rem',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    paddingTop: '1rem'
                }}>
                    {/* CO2 */}
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>CO2 (PPM)</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                            {data.co2.value} <span style={{ fontSize: '0.7rem', color: 'var(--neon-purple)' }}>{data.co2.trend === 'up' ? '↑' : '↓'}</span>
                        </div>
                    </div>

                    {/* Humidity */}
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>HUMIDITY</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                            {data.humidity.value}% <span style={{ fontSize: '0.7rem', color: 'var(--neon-cyan)' }}>{data.humidity.trend === 'up' ? '↑' : '↓'}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
