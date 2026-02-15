import React, { useState, useEffect } from 'react';
import { Activity, Cpu, Wifi, WifiOff } from 'lucide-react';

export default function Navbar({ status = 'Online' }) {
    const [time, setTime] = useState(new Date().toLocaleTimeString());

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date().toLocaleTimeString());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const isOnline = status === 'Online';

    return (
        <nav className="navbar glass-panel" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
            <div className="nav-brand">
                <Activity className="brand-icon" size={28} />
                <h1>IoT <span style={{ color: 'var(--text-muted)', fontWeight: 300 }}>MONITOR</span></h1>
            </div>

            <div className="nav-controls">
                <div className={`status-pill ${isOnline ? 'online' : 'offline'}`}
                    style={{
                        borderColor: isOnline ? 'var(--status-online)' : 'var(--status-offline)',
                        color: isOnline ? 'var(--status-online)' : 'var(--status-offline)'
                    }}>
                    {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                    <span className="status-text">{status === 'Online' ? 'SYSTEM ONLINE' : 'CONNECTION LOST'}</span>
                    <span className="status-dot" style={{ backgroundColor: isOnline ? 'var(--status-online)' : 'var(--status-offline)' }}></span>
                </div>

                <div className="time-display text-mono" style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                    {time}
                </div>

                <div className="device-selector glass-panel" style={{ padding: '0 8px', height: '36px', display: 'flex', alignItems: 'center' }}>
                    <Cpu size={16} style={{ color: 'var(--neon-blue)' }} />
                    <select defaultValue="esp32-001" style={{ border: 'none', background: 'transparent' }}>
                        <option value="esp32-001">ESP32-001</option>
                        <option value="esp32-002">ESP32-002</option>
                    </select>
                </div>
            </div>
        </nav>
    );
}
