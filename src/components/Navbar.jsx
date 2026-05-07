import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Wifi, Moon, Sun, Clock, LogOut, LayoutDashboard, Thermometer, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ status = 'Online', theme, onToggleTheme }) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const [time, setTime] = useState(
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isOnline = status === 'Online';
  const isLight  = theme === 'light';

  const initials = (profile?.name || user?.email || '?')
    .trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  async function handleLogout() {
    setShowMenu(false);
    await signOut();
    navigate('/login');
  }

  return (
    <nav className="navbar">
      {/* ── Left: brand + nav links ──────────────────── */}
      <div className="nav-left">
        <div className="nav-brand">
          <span className="nav-brand-name">IoT Monitor</span>
        </div>

        <div className="nav-links">
          <NavLink
            to="/"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            end
            id="nav-dashboard"
          >
            <LayoutDashboard size={14} />
            Dashboard
          </NavLink>
          <NavLink
            to="/survey"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            id="nav-survey"
          >
            <Thermometer size={14} />
            Comfort Survey
          </NavLink>
          <NavLink
            to="/profile"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            id="nav-profile"
          >
            <User size={14} />
            Profile
          </NavLink>
        </div>
      </div>

      {/* ── Right: status + user ─────────────────────── */}
      <div className="nav-right">
        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
            borderRadius: 6, display: 'flex', alignItems: 'center',
            color: isLight ? 'var(--amber)' : 'var(--text-muted)',
            transition: 'color 0.2s, background 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(128,128,128,0.12)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          {isLight ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* ESP32 status */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            className="nav-status-dot"
            style={{
              background: isOnline ? 'var(--green)' : 'var(--red)',
              boxShadow: `0 0 6px ${isOnline ? 'var(--green)' : 'var(--red)'}`,
            }}
          />
          <span className="nav-device">ESP32-001</span>
        </span>

        <Wifi size={15} style={{ color: 'var(--text-muted)' }} />

        {/* Clock */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={13} style={{ color: 'var(--text-muted)' }} />
          {time}
        </span>

        {/* User avatar + dropdown */}
        {user && (
          <div className="nav-user-wrap">
            <button
              className="nav-avatar" id="nav-avatar-btn"
              onClick={() => setShowMenu(v => !v)}
              title={profile?.name || user.email}
            >
              {initials}
            </button>
            {showMenu && (
              <>
                <div className="nav-dropdown-backdrop" onClick={() => setShowMenu(false)} />
                <div className="nav-dropdown">
                  <div className="nav-dropdown-info">
                    <span className="nav-dd-name">{profile?.name || 'Your Profile'}</span>
                    <span className="nav-dd-email">{user.email}</span>
                  </div>
                  <button className="nav-dd-item" onClick={() => { setShowMenu(false); navigate('/profile'); }}>
                    <User size={13} /> Profile
                  </button>
                  <button className="nav-dd-item" onClick={() => { setShowMenu(false); navigate('/survey'); }}>
                    <Thermometer size={13} /> Take Survey
                  </button>
                  <div className="nav-dd-divider" />
                  <button className="nav-dd-item logout" onClick={handleLogout} id="nav-logout-btn">
                    <LogOut size={13} /> Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
