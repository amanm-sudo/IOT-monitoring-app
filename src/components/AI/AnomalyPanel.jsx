import React from 'react';
import { ShieldAlert, CheckCircle, Activity } from 'lucide-react';

export default function AnomalyPanel({ anomalies }) {
    if (!anomalies) return null;

    const isAnomaly = anomalies.detected;

    return (
        <div className={`ai-card anomaly-card glass-panel`}
            style={{
                padding: '1.5rem',
                borderLeft: `4px solid ${isAnomaly ? 'var(--neon-red)' : 'var(--neon-green)'}`,
                background: isAnomaly ? 'linear-gradient(90deg, rgba(255, 77, 77, 0.1), rgba(20, 25, 40, 0.6))' : 'var(--bg-glass)',
                position: 'relative', overflow: 'hidden'
            }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', letterSpacing: '1px' }}>SYSTEM MONITOR</h3>
                <Activity size={16} className={isAnomaly ? 'pulse-fast' : ''} color={isAnomaly ? 'var(--neon-red)' : 'var(--neon-green)'} />
            </div>

            <div className="anomaly-score" style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '1rem' }}>
                <span className="score-value" style={{
                    fontSize: '3rem', fontWeight: 800, lineHeight: 1,
                    color: isAnomaly ? 'var(--neon-red)' : 'var(--neon-green)',
                    textShadow: isAnomaly ? '0 0 20px rgba(255, 77, 77, 0.4)' : '0 0 20px rgba(10, 255, 104, 0.4)'
                }}>{anomalies.score}</span>
                <span className="score-label" style={{ paddingBottom: '6px', color: 'var(--text-muted)' }}>/ 100 HEALTH</span>
            </div>

            <div className="status-pill" style={{
                background: isAnomaly ? 'rgba(255, 77, 77, 0.15)' : 'rgba(10, 255, 104, 0.15)',
                border: `1px solid ${isAnomaly ? 'rgba(255, 77, 77, 0.3)' : 'rgba(10, 255, 104, 0.3)'}`,
                color: isAnomaly ? 'var(--neon-red)' : 'var(--neon-green)',
                display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content',
                padding: '8px 16px', borderRadius: '100px'
            }}>
                {isAnomaly ? <ShieldAlert size={18} /> : <CheckCircle size={18} />}
                <span style={{ fontWeight: 600, letterSpacing: '0.5px' }}>
                    {isAnomaly ? `ALERT: ${anomalies.type.toUpperCase()}` : 'SYSTEM NORMAL'}
                </span>
            </div>
        </div>
    );
}
