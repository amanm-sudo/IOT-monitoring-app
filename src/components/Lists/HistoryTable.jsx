import React from 'react';
import { Database, Download } from 'lucide-react';

export default function HistoryTable({ history }) {

    const downloadCSV = () => {
        if (!history || history.length === 0) {
            alert("No data to export!");
            return;
        }

        // 1. Define Headers
        const headers = ["TIME", "TEMP (°C)", "HUMIDITY (%)", "CO2 (ppm)", "ENERGY (kWh)", "STATUS"];

        // 2. Format Data Rows
        const rows = history.map(row => [
            row.time,
            row.temperature.value,
            row.humidity.value,
            row.co2.value,
            row.energy.value,
            row.isAnomaly ? "ANOMALY" : "NORMAL"
        ]);

        // 3. Combine Headers and Rows
        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.join(","))
        ].join("\n");

        // 4. Create Blob and Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `sensor_history_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <section className="history-section glass-panel" style={{ padding: '1.5rem', marginTop: '1rem' }}>
            <div className="panel-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Database size={18} color="var(--neon-blue)" />
                    HISTORICAL DATA (Last 50)
                </h3>
                <button className="btn-export"
                    onClick={downloadCSV}
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
