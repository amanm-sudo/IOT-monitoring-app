import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Navbar from './components/Navbar';
import { APIService } from './services/api';
import { useAuth } from './context/AuthContext';
import {
    LineChart, Line,
    BarChart, Bar, Cell, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Download, ArrowRight } from 'lucide-react';

/* ─── helpers ─── */
const fmtVal = (v) => (v != null && v !== '--') ? Number(v).toFixed(1) : '--';
const fmtValInt = (v) => (v != null && v !== '--') ? Math.round(Number(v)) : '--';

/* ─── Metric Card ─── */
function TemperatureCard({ data }) {
    const val = data?.temperature?.value;
    const heights = [14, 18, 22, 28, 24, 20, 28];
    return (
        <div className="metric-card">
            <div className="metric-label">Temperature</div>
            <div className="metric-value-row">
                <span className="metric-value">{fmtVal(val)}<span style={{ fontSize: 20 }}>°C</span></span>
                <span className="metric-delta">+0.2°</span>
            </div>
            <div className="spark-bars" style={{ marginTop: 'auto' }}>
                {heights.map((h, i) => (
                    <div key={i} className={`spark-bar ${i === heights.length - 1 ? 'active' : ''}`}
                        style={{ height: h, opacity: i === heights.length - 1 ? 1 : 0.4 }} />
                ))}
            </div>
        </div>
    );
}

function EnergyCard({ data }) {
    const val = data?.energy?.value;
    return (
        <div className="metric-card">
            <div className="metric-label">Energy</div>
            <div className="metric-value-row">
                <span className="metric-value amber">{val != null ? Number(val).toFixed(1) : '--'}</span>
                <span className="metric-unit" style={{ color: 'var(--amber)' }}>kWh</span>
            </div>
            <div className="daily-limit-row">
                <span>DAILY LIMIT</span>
                <span className="daily-limit-pct">71%</span>
            </div>
            <div className="progress-bar">
                <div className="progress-fill" style={{ width: '71%' }} />
            </div>
        </div>
    );
}

function AQICard({ aqiData }) {
    const val = aqiData?.indoor?.final_aqi;
    const numVal = val != null ? Math.round(Number(val)) : 32;
    const label = numVal < 50 ? 'EXCELLENT' : numVal < 100 ? 'GOOD' : numVal < 150 ? 'MODERATE' : 'POOR';
    const color = numVal < 50 ? 'var(--teal)' : numVal < 100 ? 'var(--green)' : numVal < 150 ? 'var(--amber)' : 'var(--red)';

    return (
        <div className="metric-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="metric-label">AQI Index</div>
                <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: 0.5 }}>{label}</span>
            </div>
            <div className="metric-value-row" style={{ marginTop: 4 }}>
                <span className="metric-value teal">{numVal}</span>
            </div>
            <div className="pm25-val">PM2.5</div>
            <div className="progress-bar" style={{ marginTop: 6 }}>
                <div className="progress-fill" style={{ width: `${Math.min(numVal / 2, 100)}%`, background: color }} />
            </div>
        </div>
    );
}

function HumidityCard({ data }) {
    const val = data?.humidity?.value;
    const numVal = val != null ? Number(val) : 45;
    const pct = Math.max(0, Math.min(100, numVal));

    return (
        <div className="metric-card">
            <div className="metric-label">Humidity</div>
            <div className="metric-value-row">
                <span className="metric-value">{Math.round(pct)}<span style={{ fontSize: 18 }}>%</span></span>
            </div>
            <div className="hum-slider-wrap">
                <div className="hum-track">
                    <div className="hum-thumb" style={{ left: `${pct}%` }} />
                </div>
                <div className="hum-labels">
                    <span>DRY</span>
                    <span style={{ color: 'var(--teal)', fontWeight: 600 }}>OPTIMAL</span>
                    <span>WET</span>
                </div>
            </div>
        </div>
    );
}

function CurrentCard({ data }) {
    const val = data?.current?.value ?? data?.energy?.value;
    const heights = [10, 14, 18, 28, 22, 26, 28];
    return (
        <div className="metric-card">
            <div className="metric-label">Current</div>
            <div className="metric-value-row">
                <span className="metric-value amber">{val != null ? Number(val).toFixed(2) : '4.82'}<span style={{ fontSize: 16, color: 'var(--amber)' }}>A</span></span>
            </div>
            <div className="current-sub">238.4V • RMC</div>
            <div className="current-bars">
                {heights.map((h, i) => (
                    <div key={i} className={`current-bar ${i === heights.length - 1 ? 'active' : ''}`}
                        style={{ height: h, opacity: i === heights.length - 1 ? 1 : 0.4 }} />
                ))}
            </div>
        </div>
    );
}

/* ─── Status Bar ─── */
function StatusBar({ anomalies, aqiData, alerts }) {
    const score = anomalies?.score ?? 98;
    const isOptimal = score >= 80;
    const windowStatus = aqiData?.indoor?.window_status || 'OPEN';

    return (
        <div className="status-bar">
            <div className="status-item">
                <span className="dot dot-green" />
                System Health <span className="status-val">&nbsp;{score}/100</span>&nbsp;{isOptimal ? 'Optimal' : 'Warning'}
            </div>
            <div className="status-item">
                Window: <span className="status-teal">&nbsp;{windowStatus}&nbsp;</span>
                <span className="dot dot-teal" />
            </div>
            <div className="status-item">
                AI Insights: <span className="status-val">&nbsp;2 active</span>
            </div>
            <div className="status-item">
                Alerts: All Clear <span className="dot dot-green" style={{ marginLeft: 4 }} />
            </div>
        </div>
    );
}

/* ─── AQI Line Chart ─── */
function AQITrendChart({ history }) {
    const data = useMemo(() => {
        const timeMap = {};
        (history || []).forEach(r => {
            const t = new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (!timeMap[t]) timeMap[t] = { time: t };
            if (r.location === 'indoor') timeMap[t].indoor = +r.final_aqi;
            else if (r.location === 'outdoor') timeMap[t].outdoor = +r.final_aqi;
        });
        const sorted = Object.values(timeMap).slice(-12);
        if (sorted.length < 3) {
            return Array.from({ length: 12 }, (_, i) => ({
                time: `${String(i * 2).padStart(2, '0')}:00`,
                indoor: 30 + Math.sin(i / 2) * 15 + Math.random() * 5,
                outdoor: 50 + Math.cos(i / 3) * 20 + Math.random() * 8,
            }));
        }
        return sorted;
    }, [history]);

    return (
        <div className="chart-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span className="chart-title" style={{ marginBottom: 0 }}>Air Quality Trends</span>
                <div className="chart-legend">
                    <div className="legend-item"><div className="legend-line" style={{ background: 'var(--teal)' }} /><span>Indoor</span></div>
                    <div className="legend-item"><div className="legend-dashed" style={{ borderColor: 'var(--purple)' }} /><span>Outdoor</span></div>
                </div>
            </div>
            <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="time" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <Tooltip
                            contentStyle={{
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                fontSize: 12,
                                color: 'var(--text-primary)'
                            }}
                            labelStyle={{ color: 'var(--text-muted)' }}
                            cursor={{ stroke: 'var(--border)' }}
                        />
                        <Line type="monotone" dataKey="indoor" stroke="var(--teal)" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="outdoor" stroke="var(--purple)" strokeWidth={2} strokeDasharray="4 3" dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

/* ─── Energy Consumption – Past 7 Days Bar Chart ─── */
function ConsumptionChart({ dailyEnergy }) {
    const data = useMemo(() => {
        if (Array.isArray(dailyEnergy) && dailyEnergy.length > 0) {
            return dailyEnergy.map(d => ({
                name: d.label,
                value: d.energy != null ? +d.energy : 0,
                hasData: d.energy != null && +d.energy > 0,
                today: d.isToday,
            }));
        }
        const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        const today = new Date();
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(today);
            d.setDate(today.getDate() - (6 - i));
            const isToday = i === 6;
            return {
                name: isToday ? 'TODAY' : DAY_NAMES[d.getDay()],
                value: 0,
                hasData: false,
                today: isToday,
            };
        });
    }, [dailyEnergy]);

    const maxVal = Math.max(...data.map(d => d.value), 0);
    const yMax = maxVal > 0 ? Math.ceil(maxVal * 1.25) : 15;

    return (
        <div className="chart-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span className="chart-title" style={{ marginBottom: 0 }}>Energy Consumption – Past 7 Days</span>
                <div className="chart-legend">
                    <div className="legend-item"><div className="legend-line" style={{ background: 'var(--amber)' }} /><span>Today</span></div>
                    <div className="legend-item"><div className="legend-line" style={{ background: 'var(--teal)' }} /><span>Past days</span></div>
                </div>
            </div>
            <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis
                            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            unit=" kWh"
                            width={52}
                            domain={[0, yMax]}
                        />
                        <Tooltip
                            contentStyle={{
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                fontSize: 12,
                                color: 'var(--text-primary)'
                            }}
                            labelStyle={{ color: 'var(--text-muted)' }}
                            formatter={(val, _name, props) => [
                                props.payload.hasData ? `${Number(val).toFixed(2)} kWh` : 'No data yet',
                                'Energy'
                            ]}
                            cursor={{ fill: 'rgba(128,128,128,0.08)' }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]} minPointSize={8}>
                            {data.map((entry, index) => (
                                <Cell
                                    key={index}
                                    fill={
                                        entry.today
                                            ? 'var(--amber)'
                                            : entry.hasData
                                                ? 'var(--teal)'
                                                : 'var(--bar-rest)'
                                    }
                                    opacity={entry.hasData || entry.today ? 1 : 0.4}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}


/* ─── Power Quality Card ─── */
function PowerQualityCard({ data }) {
    const voltage = data?.voltage?.value ?? '--';
    const current = data?.current?.value ?? '--';
    const power   = (voltage !== '--' && current !== '--')
        ? (Number(voltage) * Number(current)).toFixed(0)
        : '--';
    const pf = 0.92; // typical building power factor

    const metrics = [
        { label: 'Line Voltage',    value: voltage !== '--' ? `${Number(voltage).toFixed(1)}` : '--', unit: 'V',  status: 'optimal' },
        { label: 'Load Current',    value: current !== '--' ? `${Number(current).toFixed(2)}` : '--', unit: 'A',  status: 'optimal' },
        { label: 'Active Power',    value: power,   unit: 'W',  status: Number(power) > 1500 ? 'elevated' : 'optimal' },
        { label: 'Power Factor',    value: pf,      unit: '',   status: 'optimal' },
    ];

    return (
        <div className="env-card">
            <div className="chart-title" style={{ marginBottom: 4 }}>Power Quality</div>
            {metrics.map(m => (
                <div className="env-row" key={m.label}>
                    <div className="env-meta">
                        <span className="env-name">{m.label}</span>
                        <span className={`env-status ${m.status}`}>
                            {m.status === 'elevated' ? 'High' : 'Normal'}
                        </span>
                    </div>
                    <div className="env-reading">
                        {m.value} <span className="env-unit">{m.unit}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ─── Environment Breakdown ─── */
function EnvBreakdown({ data, aqiData }) {
    const co2 = data?.co2?.value ?? (aqiData?.indoor?.co2 ?? 842);
    const pm25 = aqiData?.indoor?.pm2_5 ?? 12.4;
    const co2Status = Number(co2) > 800 ? 'Elevated' : Number(co2) > 1000 ? 'High' : 'Normal';
    const co2Class = Number(co2) > 800 ? 'elevated' : 'optimal';

    return (
        <div className="env-card">
            <div className="chart-title" style={{ marginBottom: 4 }}>Environment Breakdown</div>

            <div className="env-row">
                <div className="env-meta">
                    <span className="env-name">CO2 Concentration</span>
                    <span className={`env-status ${co2Class}`}>{co2Status}</span>
                </div>
                <div className="env-reading">{Math.round(Number(co2))} <span className="env-unit">ppm</span></div>
            </div>

            <div className="env-row">
                <div className="env-meta">
                    <span className="env-name">Fine Particulates</span>
                    <span className="env-status optimal">Optimal</span>
                </div>
                <div className="env-reading">{Number(pm25).toFixed(1)} <span className="env-unit">μg/m³</span></div>
            </div>

            <div className="env-row">
                <div className="env-meta">
                    <span className="env-name">Temp Drift</span>
                    <span className="env-status stable">Stable</span>
                </div>
                <div className="env-reading">+0.3° <span className="env-unit">/ hr</span></div>
            </div>
        </div>
    );
}

/* ─── Comfort vs Energy Combo Chart ─── */
function ComboChart({ history, user }) {
    const [surveys, setSurveys] = React.useState(null); // null = loading, [] = none
    const API = import.meta.env.VITE_API_URL || 'https://iot-monitoring-app-5xoi.onrender.com';

    // Fetch survey history once user is available
    React.useEffect(() => {
        if (!user) { setSurveys([]); return; }
        let cancelled = false;

        // Safety: if fetch hangs, fall back to empty after 6s
        const timer = setTimeout(() => {
            if (!cancelled) setSurveys(prev => prev === null ? [] : prev);
        }, 6000);

        (async () => {
            try {
                const { supabase } = await import('./lib/supabase');
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                if (!token || cancelled) { if (!cancelled) setSurveys([]); return; }

                const res = await fetch(`${API}/api/survey/history`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (cancelled) return;
                if (!res.ok) { setSurveys([]); return; }
                const json = await res.json();
                setSurveys(Array.isArray(json) ? json : []);
            } catch {
                if (!cancelled) setSurveys([]);
            }
        })();
        return () => { cancelled = true; clearTimeout(timer); };
    }, [user]);

    // Build chart data: assign each survey's comfort to only the CLOSEST data point
    const data = useMemo(() => {
        if (!surveys?.length || !history?.length) return [];
        const energySlice = [...history].reverse().slice(-20); // oldest→newest

        // Parse timestamps for each data point
        const points = energySlice.map((r, i) => ({
            row: r,
            ts: r.rawTs
                ? new Date(r.rawTs).getTime()
                : Date.now() - (energySlice.length - i) * 30000,
            comfort: null, // will be set below
        }));

        // For each survey, find the single closest data point and mark it
        const usedIndices = new Set();
        for (const s of surveys) {
            const surveyTs = new Date(s.submitted_at).getTime();
            let bestIdx = -1, bestDiff = Infinity;
            points.forEach((p, idx) => {
                const diff = Math.abs(p.ts - surveyTs);
                if (diff < bestDiff && !usedIndices.has(idx)) {
                    bestDiff = diff; bestIdx = idx;
                }
            });
            if (bestIdx >= 0) {
                points[bestIdx].comfort = s.comfort_level;
                usedIndices.add(bestIdx);
            }
        }

        return points.map(p => ({
            t: p.row.time || '',
            comfort: p.comfort,
            energy: Number(p.row.energy?.value ?? 0),
        }));
    }, [surveys, history]);

    // Empty state: no surveys yet
    if (surveys !== null && surveys.length === 0) {
        return (
            <div className="combo-chart-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 120 }}>
                <span style={{ fontSize: 28 }}>🌡️</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Comfort vs Energy</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 280 }}>
                    Complete a <strong style={{ color: 'var(--teal)' }}>Comfort Survey</strong> to see how your thermal comfort correlates with energy usage.
                </span>
            </div>
        );
    }

    // Loading state (with 5s timeout fallback to empty)
    if (surveys === null) {
        return (
            <div className="combo-chart-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 120 }}>
                <span style={{ fontSize: 28 }}>🌡️</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Comfort vs Energy</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading survey data…</span>
            </div>
        );
    }

    return (
        <div className="combo-chart-card">
            <div className="combo-header">
                <span className="chart-title" style={{ marginBottom: 0 }}>Comfort vs Energy Utilization</span>
                <div className="chart-legend">
                    <div className="legend-item"><div className="legend-line" style={{ background: 'var(--teal)' }} /><span>Comfort (0–3)</span></div>
                    <div className="legend-item"><div className="legend-line" style={{ background: 'var(--amber)' }} /><span>Energy (kWh)</span></div>
                </div>
            </div>
            <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 40, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="t" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} />

                        {/* Left Y-axis: Energy (kWh) */}
                        <YAxis
                            yAxisId="energy"
                            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                            tickLine={false} axisLine={false}
                            unit=" kWh"
                            width={50}
                        />

                        {/* Right Y-axis: Comfort (0–3) */}
                        <YAxis
                            yAxisId="comfort"
                            orientation="right"
                            domain={[0, 3]}
                            ticks={[0, 1, 2, 3]}
                            tick={{ fill: 'var(--teal)', fontSize: 10, fontWeight: 600 }}
                            tickLine={false} axisLine={false}
                            width={30}
                        />

                        <Tooltip
                            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)' }}
                            labelStyle={{ color: 'var(--text-muted)' }}
                            cursor={{ stroke: 'var(--border)' }}
                            formatter={(val, name) => {
                                if (name === 'comfort') return val != null ? [`Level ${val}`, 'Comfort'] : ['—', 'Comfort'];
                                return [`${Number(val).toFixed(2)} kWh`, 'Energy'];
                            }}
                        />

                        <Line yAxisId="comfort" type="monotone" dataKey="comfort" stroke="var(--teal)" strokeWidth={2.5}
                            dot={{ r: 5, fill: 'var(--teal)', strokeWidth: 2, stroke: '#fff' }} connectNulls={false} />
                        <Line yAxisId="energy" type="monotone" dataKey="energy" stroke="var(--amber)" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

/* ─── History Table ─── */
function HistoryTable({ history, aqiData }) {
    const indoorFallback = aqiData?.indoor;
    const downloadCSV = () => {
        if (!history?.length) { alert('No data to export!'); return; }
        const headers = ['TIME', 'TEMP (°C)', 'HUMIDITY (%)', 'CO2 (ppm)', 'ENERGY (kWh)', 'VOLTAGE (V)', 'CURRENT (A)', 'STATUS'];
        const rows = history.map(r => [
            r.time,
            r.temperature?.value ?? '--',
            r.humidity?.value ?? '--',
            r.co2?.value ?? '--',
            r.energy?.value ?? '--',
            r.voltage?.value ?? '--',
            r.current?.value ?? '--',
            r.isAnomaly ? 'Alert' : 'Nominal',
        ]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `telemetry_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    const rows = history?.length ? history.slice(0, 10) : [
        { time: '--:--:--', temperature: { value: '--' }, humidity: { value: '--' }, co2: { value: '--' }, energy: { value: '--' }, voltage: { value: '--' }, current: { value: '--' }, isAnomaly: false }
    ];

    const getStatusClass = (row, idx) => {
        if (row.isAnomaly) return 'status-alert';
        if (idx === 1) return 'status-warning';
        return 'status-nominal';
    };
    const getStatusLabel = (row, idx) => {
        if (row.isAnomaly) return 'Alert';
        if (idx === 1) return 'Warning';
        return 'Nominal';
    };

    return (
        <div className="history-card">
            <div className="history-header">
                <span className="chart-title" style={{ marginBottom: 0 }}>Historical Node Telemetry</span>
                <button className="export-btn" onClick={downloadCSV}>
                    <Download size={12} /> Export CSV
                </button>
            </div>
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Time</th><th>Temp</th><th>Humidity</th><th>CO2</th>
                        <th>Energy</th><th>Voltage</th><th>Current</th><th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i}>
                            <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{row.time}</td>
                            <td>{row.temperature?.value != null && row.temperature.value !== '--'
                                ? `${Number(row.temperature.value).toFixed(1)}°C`
                                : indoorFallback?.temperature != null
                                    ? `${Number(indoorFallback.temperature).toFixed(1)}°C`
                                    : '--°C'}
                            </td>
                            <td>{row.humidity?.value != null && row.humidity.value !== '--'
                                ? `${Number(row.humidity.value).toFixed(0)}%`
                                : indoorFallback?.humidity != null
                                    ? `${Number(indoorFallback.humidity).toFixed(0)}%`
                                    : '--%'}
                            </td>
                            <td>{row.co2?.value != null && row.co2.value !== '--'
                                ? `${Math.round(Number(row.co2.value))} ppm`
                                : indoorFallback?.co2 != null
                                    ? `${Math.round(Number(indoorFallback.co2))} ppm`
                                    : '-- ppm'}
                            </td>
                            <td className="energy-val">{row.energy?.value ?? '--'} kWh</td>
                            <td>{row.voltage?.value ?? '--'}V</td>
                            <td>{row.current?.value ?? '--'}A</td>
                            <td>
                                <span className={getStatusClass(row, i)}>
                                    <span className="status-dot-inline" />
                                    {getStatusLabel(row, i)}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/* ─── APP ─── */
export default function App() {
    /* ─ Theme ─ */
    const [theme, setTheme] = useState(() => {
        try { return localStorage.getItem('iot-theme') || 'dark'; } catch { return 'dark'; }
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        try { localStorage.setItem('iot-theme', theme); } catch { }
    }, [theme]);

    const toggleTheme = useCallback(() => {
        setTheme(t => t === 'dark' ? 'light' : 'dark');
    }, []);

    /* ─ Auth ─ */
    const { user } = useAuth();

    /* ─ Data ─ */
    const [data, setData] = useState(null);
    const [predictions, setPredictions] = useState(null);
    const [anomalies, setAnomalies] = useState(null);
    const [history, setHistory] = useState([]);
    const [dailyEnergy, setDailyEnergy] = useState(null);
    const [status, setStatus] = useState('Online');
    const [aqiData, setAqiData] = useState({ indoor: null, outdoor: null });
    const [aqiHistory, setAqiHistory] = useState([]);

    const updateDashboard = async () => {
        try {
            const [latest, historyData, preds, anoms, aqiLatest, aqiHist, dailyEnergyData] = await Promise.all([
                APIService.getLatestData(),
                APIService.getHistory(),
                APIService.getPredictions(),
                APIService.getAnomalies(),
                APIService.getAQILatest(),
                APIService.getAQIHistory(),
                APIService.getDailyEnergy(),
            ]);
            if (latest) setData(latest);
            if (historyData?.length) {
                // Use aqiLatest.indoor as fallback when no history AQI record found
                const indoorFallback = aqiLatest?.indoor;
                setHistory(historyData.map(r => {
                    const ts = new Date(r.timestamp).getTime();
                    const indoorHist = Array.isArray(aqiHist) ? aqiHist.filter(a => a.location === 'indoor') : [];
                    const closestAqi = indoorHist.length
                        ? indoorHist.reduce((best, a) => {
                            const diff = Math.abs(new Date(a.timestamp).getTime() - ts);
                            return (!best || diff < best.diff) ? { a, diff } : best;
                          }, null)?.a
                        : null;
                    const src = closestAqi || indoorFallback;
                    return {
                        time: new Date(r.timestamp).toLocaleTimeString(),
                        rawTs: r.timestamp,
                        temperature: { value: src?.temperature ?? '--' },
                        humidity:    { value: src?.humidity    ?? '--' },
                        co2:         { value: src?.co2         ?? '--' },
                        energy:  { value: r.energy_kwh ?? '--' },
                        voltage: { value: r.voltage    ?? '--' },
                        current: { value: r.current    ?? '--' },
                        isAnomaly: false,
                    };
                }));
            }
            setPredictions(preds);
            setAnomalies(anoms);
            if (aqiLatest) setAqiData(aqiLatest);
            if (aqiHist) setAqiHistory(aqiHist);
            if (dailyEnergyData) setDailyEnergy(dailyEnergyData);
            setStatus('Online');
        } catch { setStatus('Offline'); }
    };

    useEffect(() => {
        updateDashboard();
        const socket = APIService.socket;
        socket.on('connect', () => setStatus('Online'));
        socket.on('disconnect', () => setStatus('Offline'));
        socket.on('new_reading', (d) => {
            const fmt = {
                energy:  { value: d.energy_kwh, unit: 'kWh', trend: 'flat' },
                voltage: { value: d.voltage,     unit: 'V',   trend: 'flat' },
                current: { value: d.current,     unit: 'A',   trend: 'flat' },
            };
            setData(fmt);
            // Enrich history row with latest AQI indoor data
            setAqiData(prevAqi => {
                const indoor = prevAqi?.indoor;
                const newRow = {
                    time: new Date().toLocaleTimeString(),
                    temperature: { value: indoor?.temperature ?? '--' },
                    humidity:    { value: indoor?.humidity    ?? '--' },
                    co2:         { value: indoor?.co2         ?? '--' },
                    ...fmt,
                    isAnomaly: false,
                };
                setHistory(prev => [newRow, ...prev].slice(0, 50));
                return prevAqi; // don't change aqiData
            });
        });
        socket.on('new_aqi_reading', (a) => {
            setAqiData(prev => ({ ...prev, [a.location]: a }));
            setAqiHistory(prev => [a, ...prev].slice(0, 100));
        });
        const interval = setInterval(async () => {
            try {
                const [preds, anoms, aqiLatest, aqiHist, historyData, dailyEnergyData] = await Promise.all([
                    APIService.getPredictions(), APIService.getAnomalies(),
                    APIService.getAQILatest(), APIService.getAQIHistory(), APIService.getHistory(),
                    APIService.getDailyEnergy(),
                ]);
                setPredictions(preds); setAnomalies(anoms);
                if (aqiLatest) setAqiData(aqiLatest);
                if (aqiHist) setAqiHistory(aqiHist);
                if (dailyEnergyData) setDailyEnergy(dailyEnergyData);
                if (historyData?.length) {
                    const indoorFallback = aqiLatest?.indoor;
                    setHistory(historyData.map(r => {
                        const ts = new Date(r.timestamp).getTime();
                        const indoorHist = Array.isArray(aqiHist) ? aqiHist.filter(a => a.location === 'indoor') : [];
                        const closestAqi = indoorHist.length
                            ? indoorHist.reduce((best, a) => {
                                const diff = Math.abs(new Date(a.timestamp).getTime() - ts);
                                return (!best || diff < best.diff) ? { a, diff } : best;
                              }, null)?.a
                            : null;
                        const src = closestAqi || indoorFallback;
                        return {
                            time: new Date(r.timestamp).toLocaleTimeString(),
                            temperature: { value: src?.temperature ?? '--' },
                            humidity:    { value: src?.humidity    ?? '--' },
                            co2:         { value: src?.co2         ?? '--' },
                            energy:  { value: r.energy_kwh ?? '--' },
                            voltage: { value: r.voltage    ?? '--' },
                            current: { value: r.current    ?? '--' },
                            isAnomaly: false,
                        };
                    }));
                }
            } catch { }
        }, 10000);
        return () => {
            clearInterval(interval);
            socket.off('connect'); socket.off('disconnect');
            socket.off('new_reading'); socket.off('new_aqi_reading');
        };
    }, []);

    /* Merge energy-meter data with AQI indoor sensor for temp/humidity/CO2 */
    const indoorAqi = aqiData?.indoor;
    const displayData = {
        temperature: { value: indoorAqi?.temperature ?? data?.temperature?.value ?? '--' },
        humidity:    { value: indoorAqi?.humidity    ?? data?.humidity?.value    ?? '--' },
        co2:         { value: indoorAqi?.co2         ?? data?.co2?.value         ?? '--' },
        energy:      data?.energy   || { value: '0.00' },
        voltage:     data?.voltage  || { value: '--' },
        current:     data?.current  || { value: '--' },
    };

    return (
        <div className="app-shell">
            <Navbar status={status} theme={theme} onToggleTheme={toggleTheme} />
            <div className="dashboard">
                {/* Row 1: Metric Cards */}
                <div className="metric-row">
                    <TemperatureCard data={displayData} />
                    <EnergyCard data={displayData} />
                    <AQICard aqiData={aqiData} />
                    <HumidityCard data={displayData} />
                    <CurrentCard data={displayData} />
                </div>

                {/* Status Bar */}
                <StatusBar anomalies={anomalies} aqiData={aqiData} alerts={[]} />

                {/* Row 3: Charts */}
                <div className="chart-row">
                    <AQITrendChart history={aqiHistory} />
                    <ConsumptionChart dailyEnergy={dailyEnergy} />
                </div>

                {/* Row 4: Env Breakdown + Power Quality */}
                <div className="mid-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <EnvBreakdown data={displayData} aqiData={aqiData} />
                    <PowerQualityCard data={displayData} />
                </div>

                {/* Row 5: Combo Chart */}
                <ComboChart history={history} user={user} />

                {/* Row 6: History Table */}
                <HistoryTable history={history} aqiData={aqiData} />
            </div>
        </div>
    );
}
