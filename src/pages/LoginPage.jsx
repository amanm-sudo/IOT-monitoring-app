import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Zap, Thermometer } from 'lucide-react';

/* ── small input helper ─────────────────────────────────────── */
function Field({ id, label, type = 'text', value, onChange, placeholder, rightEl }) {
  return (
    <div className="auth-field">
      <label htmlFor={id} className="auth-label">{label}</label>
      <div className="auth-input-wrap">
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="auth-input"
          autoComplete="off"
        />
        {rightEl}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab]         = useState('login');   // 'login' | 'register'
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [password, setPwd]    = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError]     = useState('');
  const [info, setInfo]       = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => { setError(''); setInfo(''); };

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    reset();
    try {
      if (tab === 'login') {
        await signIn({ email, password });
        navigate('/');
      } else {
        if (!name.trim()) { setError('Name is required.'); setLoading(false); return; }
        const result = await signUp({ email, password, name });
        // If Supabase auto-confirmed (email confirm disabled) we can go straight to dashboard
        if (result?.session) {
          navigate('/');
        } else {
          setInfo('Account created! Check your email to confirm, then sign in.');
          setTab('login');
        }

      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      {/* ── Left panel – brand ──────────────────────────── */}
      <div className="auth-brand-panel">
        <div className="auth-brand-content">
          <div className="auth-brand-icon">
            <Zap size={28} strokeWidth={2.2} />
          </div>
          <h1 className="auth-brand-title">IoT Monitor</h1>
          <p className="auth-brand-sub">
            Real-time atmospheric &amp; energy intelligence for your environment.
          </p>

          <div className="auth-feature-list">
            {[
              { icon: '⚡', text: 'Live energy metering' },
              { icon: '💨', text: 'Indoor AQI &amp; CO₂ tracking' },
              { icon: '🌡️', text: 'Thermal comfort analysis' },
              { icon: '🤖', text: 'ML-powered recommendations' },
            ].map(f => (
              <div key={f.text} className="auth-feature-item">
                <span className="auth-feature-icon" dangerouslySetInnerHTML={{ __html: f.icon }} />
                <span dangerouslySetInnerHTML={{ __html: f.text }} />
              </div>
            ))}
          </div>
        </div>
        <div className="auth-brand-glow" />
      </div>

      {/* ── Right panel – form ──────────────────────────── */}
      <div className="auth-form-panel">
        <div className="auth-card">
          {/* Tab toggle */}
          <div className="auth-tabs">
            <button
              className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
              onClick={() => { setTab('login'); reset(); }}
            >
              Sign In
            </button>
            <button
              className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
              onClick={() => { setTab('register'); reset(); }}
            >
              Create Account
            </button>
          </div>

          <h2 className="auth-heading">
            {tab === 'login' ? 'Welcome back' : 'Set up your account'}
          </h2>
          <p className="auth-subheading">
            {tab === 'login'
              ? 'Sign in to access your dashboard and comfort profile.'
              : 'Start monitoring your environment in under a minute.'}
          </p>

          {error && <div className="auth-alert auth-alert-error">{error}</div>}
          {info  && <div className="auth-alert auth-alert-info">{info}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            {tab === 'register' && (
              <Field
                id="auth-name" label="Full Name" value={name}
                onChange={e => setName(e.target.value)} placeholder="Aman M."
              />
            )}
            <Field
              id="auth-email" label="Email" type="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
            />
            <Field
              id="auth-password" label="Password"
              type={showPwd ? 'text' : 'password'}
              value={password} onChange={e => setPwd(e.target.value)}
              placeholder="At least 8 characters"
              rightEl={
                <button
                  type="button" className="auth-eye" onClick={() => setShowPwd(v => !v)}
                  tabIndex={-1} aria-label="Toggle password visibility"
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />

            <button
              type="submit" className="auth-submit" disabled={loading}
              id="auth-submit-btn"
            >
              {loading
                ? <span className="spinner-sm" />
                : tab === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="auth-switch">
            {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              className="auth-switch-link"
              onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); reset(); }}
            >
              {tab === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
