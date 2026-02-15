import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

export default function AlertsList({ alerts }) {
    return (
        <div className="alerts-panel glass-panel" style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={18} color="var(--status-warning)" />
                    RECENT ALERTS
                </h3>
                <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>LIVE</span>
            </div>

            <div className="alerts-content" style={{ flex: 1, overflowY: 'auto' }}>
                <ul className="alerts-list" style={{ listStyle: 'none', padding: 0 }}>
                    {alerts.length === 0 && (
                        <li style={{ color: 'var(--text-muted)', padding: '2rem 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                            <ShieldCheck size={32} color="var(--text-muted)" style={{ opacity: 0.5 }} />
                            <span>No active alerts. System is stable.</span>
                        </li>
                    )}
                    {alerts.map((alert, index) => (
                        <li key={index} className="alert-item" style={{
                            padding: '12px',
                            marginBottom: '8px',
                            background: 'rgba(255,255,255,0.02)',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.05)',
                            display: 'flex',
                            gap: '12px',
                            alignItems: 'center',
                            transition: 'background 0.2s',
                            cursor: 'default'
                        }}>
                            <div style={{
                                padding: '8px', borderRadius: '50%',
                                background: alert.severity === 'critical' ? 'rgba(255, 77, 77, 0.1)' : 'rgba(255, 191, 0, 0.1)',
                                color: alert.severity === 'critical' ? 'var(--neon-red)' : 'var(--status-warning)'
                            }}>
                                <AlertTriangle size={16} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px' }}>{alert.type}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{alert.time}</div>
                            </div>
                            <div style={{
                                width: '6px', height: '6px', borderRadius: '50%',
                                background: alert.severity === 'critical' ? 'var(--neon-red)' : 'var(--status-warning)',
                                boxShadow: `0 0 8px ${alert.severity === 'critical' ? 'var(--neon-red)' : 'var(--status-warning)'}`
                            }}></div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
