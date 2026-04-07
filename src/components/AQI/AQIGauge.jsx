import React from 'react';

export default function AQIGauge({ value = 0, label = 'AQI', size = 180 }) {
    const clampedValue = Math.min(Math.max(value, 0), 500);

    // AQI level config
    const getLevel = (v) => {
        if (v <= 50) return { label: 'Good', color: '#0aff68', bg: 'rgba(10,255,104,0.1)' };
        if (v <= 100) return { label: 'Moderate', color: '#ffbf00', bg: 'rgba(255,191,0,0.1)' };
        if (v <= 150) return { label: 'Sensitive', color: '#ff8c00', bg: 'rgba(255,140,0,0.1)' };
        if (v <= 200) return { label: 'Unhealthy', color: '#ff0055', bg: 'rgba(255,0,85,0.1)' };
        if (v <= 300) return { label: 'Very Unhealthy', color: '#bc13fe', bg: 'rgba(188,19,254,0.1)' };
        return { label: 'Hazardous', color: '#7e0023', bg: 'rgba(126,0,35,0.15)' };
    };

    const level = getLevel(clampedValue);
    const radius = (size - 30) / 2;
    const circumference = Math.PI * radius; // half circle
    const progress = (clampedValue / 500) * circumference;
    const center = size / 2;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem'
        }}>
            <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
                {/* Background arc */}
                <path
                    d={`M 15 ${center} A ${radius} ${radius} 0 0 1 ${size - 15} ${center}`}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="12"
                    strokeLinecap="round"
                />
                {/* Progress arc */}
                <path
                    d={`M 15 ${center} A ${radius} ${radius} 0 0 1 ${size - 15} ${center}`}
                    fill="none"
                    stroke={level.color}
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${progress} ${circumference}`}
                    style={{
                        filter: `drop-shadow(0 0 8px ${level.color})`,
                        transition: 'stroke-dasharray 0.8s ease, stroke 0.5s ease'
                    }}
                />
                {/* Value text */}
                <text
                    x={center}
                    y={center - 15}
                    textAnchor="middle"
                    fill="var(--text-primary)"
                    fontSize="2.2rem"
                    fontWeight="700"
                    fontFamily="var(--font-main)"
                >
                    {Math.round(clampedValue)}
                </text>
                <text
                    x={center}
                    y={center + 10}
                    textAnchor="middle"
                    fill={level.color}
                    fontSize="0.85rem"
                    fontWeight="600"
                    fontFamily="var(--font-main)"
                >
                    {level.label}
                </text>
            </svg>
            <span style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '1px'
            }}>{label}</span>
        </div>
    );
}
