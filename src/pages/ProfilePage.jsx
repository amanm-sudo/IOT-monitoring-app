import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Calendar, Mail, Save, CheckCircle, Thermometer } from 'lucide-react';
import { supabase } from '../lib/supabase';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const LEVEL_COLORS = { 0: '#6b7fad', 1: '#2dd4bf', 2: '#f59e0b', 3: '#f87171' };
const LEVEL_LABELS = { 0: 'Cold', 1: 'Slightly Cool', 2: 'Slightly Warm', 3: 'Hot' };
const LEVEL_EMOJIS = { 0: '❄️', 1: '🌡️', 2: '🌤️', 3: '🔥' };

/* ── helper: get Supabase session token ──────────────────────── */
async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
}

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();

  const [name,    setName]   = useState('');
  const [dob,     setDob]    = useState('');
  const [saving,  setSaving] = useState(false);
  const [saved,   setSaved]  = useState(false);
  const [surveys, setSurveys]= useState([]);
  const [loadSrv, setLoadSrv]= useState(true);

  /* populate form when profile loads */
  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setDob(profile.dob ? profile.dob.slice(0, 10) : '');
    }
  }, [profile]);

  /* fetch survey history */
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res   = await fetch(`${API}/api/survey/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setSurveys(await res.json());
      } catch { /* silent */ } finally {
        setLoadSrv(false);
      }
    })();
  }, []);

  /* initials for avatar */
  const initials = name
    ? name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0] || '?').toUpperCase();

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setSaved(false);
    try {
      const token = await getToken();
      await fetch(`${API}/api/profile`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ name, dob }),
      });
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  }

  const surveysCount = surveys.length;
  const firstSeen    = profile?.created_at
    ? Math.floor((Date.now() - new Date(profile.created_at)) / 86400000)
    : 0;

  return (
    <div className="profile-shell">
      {/* ── Avatar + info ──────────────────────────────── */}
      <div className="profile-hero">
        <div className="profile-avatar">{initials}</div>
        <div>
          <h1 className="profile-name">{name || 'Your Name'}</h1>
          <p className="profile-email-disp">{user?.email}</p>
        </div>
        <div className="profile-stats-row">
          <div className="profile-stat">
            <span className="profile-stat-val">{surveysCount}</span>
            <span className="profile-stat-label">Surveys</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-val">{firstSeen}</span>
            <span className="profile-stat-label">Days monitoring</span>
          </div>
        </div>
      </div>

      <div className="profile-body">
        {/* ── Edit form ─────────────────────────────────── */}
        <div className="profile-section">
          <h2 className="profile-section-title">Personal Information</h2>
          <form className="profile-form" onSubmit={handleSave}>

            <div className="profile-field">
              <label htmlFor="p-name" className="profile-label">
                <User size={13} /> Full Name
              </label>
              <input
                id="p-name" className="profile-input"
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Your full name"
              />
            </div>

            <div className="profile-field">
              <label htmlFor="p-dob" className="profile-label">
                <Calendar size={13} /> Date of Birth
              </label>
              <input
                id="p-dob" type="date" className="profile-input"
                value={dob} onChange={e => setDob(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
              />
            </div>

            <div className="profile-field">
              <label className="profile-label">
                <Mail size={13} /> Email Address
              </label>
              <input
                className="profile-input readonly" value={user?.email || ''} readOnly
                title="Email cannot be changed — managed by Supabase"
              />
            </div>

            <button
              type="submit" className="profile-save-btn" disabled={saving}
              id="profile-save-btn"
            >
              {saving ? <span className="spinner-sm" /> : saved
                ? <><CheckCircle size={15} /> Saved!</>
                : <><Save size={15} /> Save Changes</>
              }
            </button>
          </form>
        </div>

        {/* ── Survey history ─────────────────────────────── */}
        <div className="profile-section">
          <h2 className="profile-section-title">
            <Thermometer size={15} style={{ color: 'var(--teal)' }} />
            Recent Comfort Surveys
          </h2>
          {loadSrv && <div className="profile-loading">Loading surveys…</div>}
          {!loadSrv && surveys.length === 0 && (
            <div className="profile-empty">No surveys yet. <a href="/survey" style={{ color: 'var(--teal)' }}>Take one →</a></div>
          )}
          {!loadSrv && surveys.slice(0, 6).map((s, i) => {
            const color = LEVEL_COLORS[s.comfort_level] ?? 'var(--text-muted)';
            return (
              <div key={s.id || i} className="survey-history-row">
                <div className="survey-hist-left">
                  <span className="survey-hist-emoji">{LEVEL_EMOJIS[s.comfort_level] ?? '🌡️'}</span>
                  <div>
                    <div className="survey-hist-label" style={{ color }}>
                      Level {s.comfort_level} — {LEVEL_LABELS[s.comfort_level] ?? s.comfort_label}
                    </div>
                    <div className="survey-hist-date">
                      {new Date(s.submitted_at).toLocaleString('en-IN', {
                        dateStyle: 'medium', timeStyle: 'short',
                      })}
                    </div>
                  </div>
                </div>
                <div
                  className="survey-hist-badge"
                  style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
                >
                  {LEVEL_LABELS[s.comfort_level] ?? s.comfort_label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
