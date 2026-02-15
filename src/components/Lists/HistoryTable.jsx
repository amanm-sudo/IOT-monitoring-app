import React from 'react';
import { Database, Download } from 'lucide-react';

export default function HistoryTable({ history }) {
    return (
        <section className="history-section glass-panel" style={{ padding: '1.5rem', marginTop: '1rem' }}>
            <div className="panel-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Database size={18} color="var(--neon-blue)" />
                    HISTORICAL DATA (Last 50)
                </h3>
                <button className="btn-export"
                    onClick={() => alert("Exporting CSV...")}
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'var(--text-primary)',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                    <Download size={14} />
                    Export CSV
                </button>
            </div>

            <div className="table-container" style={{ overflowX: 'auto' }}>
                <table className="history-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                            <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>TIME</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>TEMP (°C)</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>HUMIDITY (%)</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>CO2 (ppm)</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>ENERGY (kWh)</th>
                            <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>STATUS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map((row, index) => (
                            <tr key={index} style={{
                                borderBottom: '1px solid rgba(255,255,255,0.02)',
                                transition: 'background 0.2s'
                            }}
                                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <td style={{ padding: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{row.time}</td>
                                <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{row.temperature.value}</td>
                                <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{row.humidity.value}</td>
                                <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{row.co2.value}</td>
                                <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{row.energy.value}</td>
                                <td style={{ padding: '12px' }}>
                                    <span className="badge" style={{
                                        background: row.isAnomaly ? 'rgba(255, 77, 77, 0.1)' : 'rgba(10, 255, 104, 0.1)',
                                        color: row.isAnomaly ? 'var(--neon-red)' : 'var(--neon-green)',
                                        padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                                        border: `1px solid ${row.isAnomaly ? 'rgba(255, 77, 77, 0.2)' : 'rgba(10, 255, 104, 0.2)'}`
                                    }}>
                                        {row.isAnomaly ? 'ANOMALY' : 'NORMAL'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
