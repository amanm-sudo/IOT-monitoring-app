import React from 'react';
import AQIGauge from './AQIGauge';
import { Wind, Droplets, Cloud, Flame, DoorOpen, DoorClosed, ThermometerSun } from 'lucide-react';

const PollutantCard = ({ label, value, unit, icon: Icon, color, maxVal }) => {
    const percent = Math.min((value / maxVal) * 100, 100);
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            padding: '1rem',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(255,255,255,0.05)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Icon size={16} style={{ color, filter: `drop-shadow(0 0 4px ${color})` }} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
                </div>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {typeof value === 'number' ? value.toFixed(1) : value}
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 2 }}>{unit}</span>
                </span>
            </div>
            <div style={{
                height: 4,
                borderRadius: 2,
                background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden'
            }}>
                <div style={{
                    height: '100%',
                    width: `${percent}%`,
                    background: color,
                    borderRadius: 2,
                    transition: 'width 0.6s ease',
                    boxShadow: `0 0 8px ${color}`
                }} />
            </div>
        </div>
    );
};

export default function AQIOverview({ indoor, outdoor }) {
    const hasIndoor = indoor && indoor.final_aqi != null;
    const hasOutdoor = outdoor && outdoor.final_aqi != null;

    const indoorAQI = hasIndoor ? Number(indoor.final_aqi) : 0;
    const outdoorAQI = hasOutdoor ? Number(outdoor.final_aqi) : 0;
    const windowStatus = indoor?.window_status || 'closed';

    const isOpen = windowStatus === 'open';

    return (
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0 }}>AIR QUALITY INDEX</h2>
                <span className="badge" style={{
                    background: isOpen ? 'rgba(10,255,104,0.1)' : 'rgba(255,0,85,0.1)',
                    border: `1px solid ${isOpen ? 'var(--neon-green)' : 'var(--neon-red)'}`,
                    color: isOpen ? 'var(--neon-green)' : 'var(--neon-red)',
                    display: 'flex', alignItems: 'center', gap: 4
                }}>
                    {isOpen ? <DoorOpen size={12} /> : <DoorClosed size={12} />}
                    WINDOW {windowStatus.toUpperCase()}
                </span>
            </div>

            {/* Gauges Row */}
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
                <AQIGauge value={indoorAQI} label="Indoor AQI" size={180} />
                <AQIGauge value={outdoorAQI} label="Outdoor AQI" size={140} />
            </div>

            {/* Comparison Bar */}
            <div style={{
                padding: '0.75rem 1rem',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(255,255,255,0.05)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--neon-cyan)' }}>Indoor: {indoorAQI.toFixed(0)}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--neon-purple)' }}>Outdoor: {outdoorAQI.toFixed(0)}</span>
                </div>
                <div style={{
                    display: 'flex', height: 8, borderRadius: 4,
                    background: 'rgba(255,255,255,0.04)', overflow: 'hidden'
                }}>
                    <div style={{
                        width: `${(indoorAQI / (indoorAQI + outdoorAQI || 1)) * 100}%`,
                        background: 'linear-gradient(90deg, var(--neon-cyan), #0090a3)',
                        transition: 'width 0.6s ease'
                    }} />
                    <div style={{
                        flex: 1,
                        background: 'linear-gradient(90deg, #6b00a0, var(--neon-purple))',
                        transition: 'width 0.6s ease'
                    }} />
                </div>
            </div>

            {/* Pollutant Cards */}
            {hasIndoor && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                    <PollutantCard label="PM 2.5" value={Number(indoor.pm2_5)} unit="µg/m³" icon={Cloud} color="var(--neon-cyan)" maxVal={250} />
                    <PollutantCard label="PM 10" value={Number(indoor.pm10)} unit="µg/m³" icon={Wind} color="var(--neon-blue)" maxVal={500} />
                    <PollutantCard label="CO₂" value={Number(indoor.co2)} unit="ppm" icon={Flame} color="var(--neon-green)" maxVal={2000} />
                    <PollutantCard label="TVOC" value={Number(indoor.tvoc)} unit="ppb" icon={Droplets} color="var(--neon-purple)" maxVal={1000} />
                    <PollutantCard label="Temperature" value={Number(indoor.temperature)} unit="°C" icon={ThermometerSun} color="var(--neon-red)" maxVal={50} />
                    <PollutantCard label="Humidity" value={Number(indoor.humidity)} unit="%" icon={Droplets} color="var(--neon-blue)" maxVal={100} />
                </div>
            )}
        </div>
    );
}
