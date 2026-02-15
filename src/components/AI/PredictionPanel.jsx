import React from 'react';
import { TrendingUp, Zap, Thermometer } from 'lucide-react';

export default function PredictionPanel({ predictions }) {
    if (!predictions) return null;

    const nextTemp = predictions.temperature ? predictions.temperature[0].toFixed(1) : '--';
    const confidence = predictions.confidence || 0;
    const nextEnergy = predictions.energy ? predictions.energy[0].toFixed(2) : '--';

    return (
        <>
            <div className="ai-card prediction-card glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="card-header" style={{ marginBottom: 0 }}>
                    <h3 style={{ fontSize: '0.85rem', color: 'var(--neon-purple)', letterSpacing: '1px' }}>TEMP FORECAST</h3>
                    <Thermometer size={16} color="var(--neon-purple)" />
                </div>
                <div className="forecast-value" style={{ marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{nextTemp}°C</span>
                    <small style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>predicted for next 5min</small>
                </div>

                <div className="confidence-section" style={{ marginTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                        <span>AI Confidence</span>
                        <span>{confidence}%</span>
                    </div>
                    <div className="confidence-bar" style={{
                        height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden'
                    }}>
                        <div className="fill" style={{
                            width: `${confidence}%`,
                            height: '100%',
                            background: `linear-gradient(90deg, var(--neon-purple), var(--neon-blue))`,
                            boxShadow: '0 0 10px var(--neon-purple)',
                            transition: 'width 0.5s ease'
                        }}></div>
                    </div>
                </div>
            </div>

            <div className="ai-card prediction-card glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="card-header" style={{ marginBottom: 0 }}>
                    <h3 style={{ fontSize: '0.85rem', color: 'var(--neon-cyan)', letterSpacing: '1px' }}>ENERGY FORECAST</h3>
                    <Zap size={16} color="var(--neon-cyan)" />
                </div>
                <div className="forecast-value" style={{ marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{nextEnergy} <span style={{ fontSize: '1rem' }}>kWh</span></span>
                    <small style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>predicted usage next hr</small>
                </div>
            </div>
        </>
    );
}
