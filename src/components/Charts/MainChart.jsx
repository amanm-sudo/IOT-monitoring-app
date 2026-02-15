import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity, Droplets, Wind, Thermometer } from 'lucide-react';

const METRICS = {
    temperature: { label: 'Temperature', unit: '°C', color: 'var(--neon-cyan)', icon: Thermometer },
    humidity: { label: 'Humidity', unit: '%', color: 'var(--neon-blue)', icon: Droplets },
    co2: { label: 'CO2 Levels', unit: 'ppm', color: 'var(--neon-green)', icon: Wind }
};

const CustomTooltip = ({ active, payload, label, metric }) => {
    if (active && payload && payload.length) {
        const conf = METRICS[metric];
        return (
            <div className="glass-panel" style={{ padding: '12px', borderColor: conf.color, boxShadow: `0 0 15px ${conf.color}33` }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>{label}</p>
                {payload.map((entry, index) => (
                    <p key={index} style={{ color: entry.stroke, fontSize: '0.9rem', fontWeight: 600 }}>
                        {entry.name}: {entry.value.toFixed(1)} {conf.unit}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

export default function MainChart({ data, predictions }) {
    const [activeMetric, setActiveMetric] = useState('temperature');
    const [history, setHistory] = useState([]);

    const MetricIcon = METRICS[activeMetric].icon;

    useEffect(() => {
        if (!data || !predictions) return;

        setHistory(prev => {
            const now = new Date().toLocaleTimeString();

            // Get values based on active metric
            let actualValue = 0;
            let predictedVal = 0;

            if (activeMetric === 'temperature') {
                actualValue = parseFloat(data.temperature.value);
                predictedVal = predictions.temperature[0];
            } else if (activeMetric === 'humidity') {
                actualValue = parseFloat(data.humidity.value);
                predictedVal = predictions.humidity[0];
            } else if (activeMetric === 'co2') {
                actualValue = parseFloat(data.co2.value);
                predictedVal = predictions.co2[0];
            }

            const newPoint = {
                time: now,
                actual: actualValue,
                predicted: predictedVal
            };

            const newHistory = [...prev, newPoint];
            if (newHistory.length > 20) newHistory.shift();
            return newHistory;
        });
    }, [data, predictions, activeMetric]); // Reset history on metric change could be an option, but keeping stream is better. 
    // Actually, on metric change we probably want to clear history or it will look weird jumping from 20C to 400ppm

    // Clear history when metric changes
    useEffect(() => {
        setHistory([]);
    }, [activeMetric]);

    return (
        <div className="chart-card glass-panel" style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    <MetricIcon size={18} color={METRICS[activeMetric].color} />
                    REAL-TIME {METRICS[activeMetric].label.toUpperCase()}
                </h3>

                {/* Metric Toggles */}
                <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px' }}>
                    {Object.entries(METRICS).map(([key, config]) => (
                        <button
                            key={key}
                            onClick={() => setActiveMetric(key)}
                            style={{
                                background: activeMetric === key ? config.color : 'transparent',
                                color: activeMetric === key ? '#000' : 'var(--text-muted)',
                                border: 'none',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            {config.label === 'CO2 Levels' ? 'CO2' : config.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="chart-container" style={{ flex: 1, minHeight: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history}>
                        <defs>
                            <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={METRICS[activeMetric].color} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={METRICS[activeMetric].color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="time" hide />
                        <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} domain={['auto', 'auto']} />
                        <Tooltip content={<CustomTooltip metric={activeMetric} />} />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                        <Area
                            type="monotone"
                            dataKey="actual"
                            name={`Actual ${METRICS[activeMetric].unit}`}
                            stroke={METRICS[activeMetric].color}
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorActual)"
                            activeDot={{ r: 6, stroke: 'var(--bg-deep)', strokeWidth: 2 }}
                        />
                        <Area
                            type="monotone"
                            dataKey="predicted"
                            name={`Predicted ${METRICS[activeMetric].unit}`}
                            stroke={METRICS[activeMetric].color}
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            fillOpacity={0}
                            strokeOpacity={0.5}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
