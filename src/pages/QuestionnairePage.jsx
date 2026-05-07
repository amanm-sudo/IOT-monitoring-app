import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CheckCircle, AlertTriangle, Thermometer, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';


/* ─────────────────────── Question data ─────────────────────── */
const QUESTIONS = [
  {
    id: 'gender',
    label: 'What is your gender?',
    sub: 'Used to calibrate metabolic rate in the thermal model.',
    type: 'card',
    options: [
      { value: 'male',   label: 'Male',   emoji: '👨' },
      { value: 'female', label: 'Female', emoji: '👩' },
      { value: 'other',  label: 'Other',  emoji: '🧑' },
    ],
  },
  {
    id: 'thermal_sensation',
    label: 'How do you feel thermally right now?',
    sub: 'ASHRAE 7-point scale — tap the value that best describes your current sensation.',
    type: 'scale',
    min: -3, max: 3,
    labels: {
      '-3': 'Cold',  '-2': 'Cool',  '-1': 'Slightly Cool',
       '0': 'Neutral',
       '1': 'Slightly Warm', '2': 'Warm', '3': 'Hot',
    },
  },
  {
    id: 'activity',
    label: 'What is your current activity level?',
    sub: 'This determines your metabolic heat output.',
    type: 'card',
    options: [
      { value: 'resting',  label: 'Resting',       emoji: '🪑', sub: 'Sedentary / Desk work' },
      { value: 'standing', label: 'Standing',       emoji: '🧍', sub: 'Light standing activity' },
      { value: 'walking',  label: 'Light Walking',  emoji: '🚶', sub: 'Slow / casual pace' },
      { value: 'exercise', label: 'Exercising',     emoji: '🏃', sub: 'Moderate–vigorous effort' },
    ],
  },
  {
    id: 'clothing',
    label: 'How are you dressed?',
    sub: 'Clothing insulation (CLO value) affects your heat balance.',
    type: 'card',
    options: [
      { value: 'minimal', label: 'Minimal',  emoji: '👕', sub: 'Shorts / T-shirt' },
      { value: 'light',   label: 'Light',    emoji: '👔', sub: 'Trousers + light shirt' },
      { value: 'medium',  label: 'Medium',   emoji: '🧥', sub: 'Trousers + sweater' },
      { value: 'heavy',   label: 'Heavy',    emoji: '🧣', sub: 'Full winter ensemble' },
    ],
  },
  {
    id: 'air_movement',
    label: 'How would you describe the air movement?',
    sub: 'Higher airflow increases evaporative cooling.',
    type: 'card',
    options: [
      { value: 'still',    label: 'Still',          emoji: '🌫️', sub: 'No noticeable air' },
      { value: 'slight',   label: 'Slight Breeze',  emoji: '🍃', sub: 'Barely perceptible' },
      { value: 'moderate', label: 'Moderate',       emoji: '💨', sub: 'Fan / open window' },
      { value: 'strong',   label: 'Strong',         emoji: '🌬️', sub: 'Noticeably windy / AC' },
    ],
  },
  {
    id: 'humidity_pref',
    label: 'How does the humidity feel?',
    sub: 'Your current perception of moisture in the air.',
    type: 'card',
    options: [
      { value: 'dry',         label: 'Too Dry',    emoji: '🏜️', sub: 'Dry skin / throat' },
      { value: 'comfortable', label: 'Comfortable',emoji: '✅', sub: 'Feels just right' },
      { value: 'humid',       label: 'Too Humid',  emoji: '💧', sub: 'Sticky / muggy' },
    ],
  },
  {
    id: 'ventilation_pref',
    label: 'What would you prefer for ventilation?',
    sub: 'Your preference for how air should circulate in the space.',
    type: 'card',
    options: [
      { value: 'less',  label: 'Less Ventilation', emoji: '🔒', sub: 'Keep windows/vents closed' },
      { value: 'same',  label: 'Keep as is',       emoji: '⚖️', sub: 'Current level is fine' },
      { value: 'more',  label: 'More Ventilation', emoji: '🪟', sub: 'Open windows / increase fan' },
    ],
  },
];

/* ─────────────────────── Sub-components ────────────────────── */
function CardOptions({ options, value, onChange }) {
  return (
    <div className={`q-cards q-cards-${options.length <= 3 ? '3' : '4'}`}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          className={`q-card ${value === opt.value ? 'selected' : ''}`}
          onClick={() => onChange(opt.value)}
          id={`qcard-${opt.value}`}
        >
          <span className="q-card-emoji">{opt.emoji}</span>
          <span className="q-card-label">{opt.label}</span>
          {opt.sub && <span className="q-card-sub">{opt.sub}</span>}
        </button>
      ))}
    </div>
  );
}

function ScaleInput({ min, max, labels, value, onChange }) {
  const points = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className="q-scale-wrap">
      <div className="q-scale-row">
        {points.map(p => (
          <button
            key={p}
            type="button"
            className={`q-scale-btn ${value === p ? 'active' : ''}`}
            onClick={() => onChange(p)}
            id={`scale-${p}`}
          >
            <span className="q-scale-num">{p > 0 ? `+${p}` : p}</span>
            <span className="q-scale-lbl">{labels[String(p)]}</span>
          </button>
        ))}
      </div>
      {value !== null && (
        <div className="q-scale-selected">
          Selected: <strong>{value > 0 ? `+${value}` : value}</strong> — {labels[String(value)]}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── Comfort Result ────────────────────── */
const LEVEL_CONFIG = {
  0: { label: 'Cold',            color: '#6b7fad', emoji: '❄️',  glow: 'rgba(107,127,173,0.35)' },
  1: { label: 'Slightly Cool',   color: '#2dd4bf', emoji: '🌡️', glow: 'rgba(45,212,191,0.35)' },
  2: { label: 'Slightly Warm',   color: '#f59e0b', emoji: '🌤️', glow: 'rgba(245,158,11,0.35)' },
  3: { label: 'Hot',             color: '#f87171', emoji: '🔥', glow: 'rgba(248,113,113,0.35)' },
};

function ComfortResult({ result, onRedo }) {
  const cfg = LEVEL_CONFIG[result.comfort_level] || LEVEL_CONFIG[1];
  const isExtreme = result.comfort_level === 0 || result.comfort_level === 3;

  return (
    <div className="result-wrap">
      <div className="result-card">
        {/* Dial */}
        <div className="result-dial-wrap">
          <svg width="220" height="130" viewBox="0 0 220 130">
            <defs>
              <linearGradient id="dialGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#6b7fad" />
                <stop offset="33%"  stopColor="#2dd4bf" />
                <stop offset="66%"  stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#f87171" />
              </linearGradient>
            </defs>
            {/* Track */}
            <path d="M 20 110 A 90 90 0 0 1 200 110" fill="none"
              stroke="rgba(255,255,255,0.06)" strokeWidth="16" strokeLinecap="round" />
            {/* Colored arc */}
            <path d="M 20 110 A 90 90 0 0 1 200 110" fill="none"
              stroke="url(#dialGrad)" strokeWidth="16" strokeLinecap="round" opacity="0.75" />
            {/* Tick marks */}
            {[0, 1, 2, 3].map(i => {
              const a = -180 + i * 60;
              const r = (a * Math.PI) / 180;
              const cx = 110, cy = 110, R = 90;
              return (
                <circle
                  key={i}
                  cx={cx + R * Math.cos(r)}
                  cy={cy + R * Math.sin(r)}
                  r={i === result.comfort_level ? 7 : 4}
                  fill={i === result.comfort_level ? cfg.color : 'rgba(255,255,255,0.2)'}
                  style={i === result.comfort_level
                    ? { filter: `drop-shadow(0 0 6px ${cfg.color})` }
                    : {}}
                />
              );
            })}
          </svg>
          <div className="result-emoji">{cfg.emoji}</div>
        </div>

        <div className="result-level-badge" style={{ color: cfg.color, borderColor: cfg.color,
          boxShadow: `0 0 18px ${cfg.glow}` }}>
          Level {result.comfort_level} — {cfg.label}
        </div>

        <h2 className="result-heading">{result.label}</h2>

        {/* Action */}
        <div className={`result-action ${isExtreme ? 'extreme' : 'neutral'}`}>
          {isExtreme ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
          <span>{result.action}</span>
        </div>

        {result.note && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{result.note}</p>
        )}

        {isExtreme && (
          <p className="result-email-note">📧 An HVAC alert email has been sent to your inbox.</p>
        )}

        <button className="q-submit-btn" onClick={onRedo} style={{ marginTop: 20 }}>
          Retake Survey
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────── Main Page ─────────────────────────── */
export default function QuestionnairePage() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const [answers, setAnswers] = useState({
    gender: null,
    thermal_sensation: null,
    activity: null,
    clothing: null,
    air_movement: null,
    humidity_pref: null,
    ventilation_pref: null,
  });
  const [step,      setStep]   = useState(0);   // which question is active
  const [result,    setResult] = useState(null);
  const [loading,   setLoading]= useState(false);
  const [error,     setError]  = useState('');

  const q     = QUESTIONS[step];
  const total = QUESTIONS.length;

  function setAnswer(id, val) {
    setAnswers(prev => ({ ...prev, [id]: val }));
  }

  const canNext = answers[q.id] !== null && answers[q.id] !== undefined;

  function goNext() {
    if (step < total - 1) { setStep(s => s + 1); return; }
    handleSubmit();
  }
  function goPrev() { if (step > 0) setStep(s => s - 1); }

  async function handleSubmit() {
    setLoading(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`${API}/api/survey/submit`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(answers),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Submission failed');
      setResult(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleRedo() { setResult(null); setStep(0); setAnswers({ gender:null, thermal_sensation:null, activity:null, clothing:null, air_movement:null, humidity_pref:null, ventilation_pref:null }); }

  /* ── Result state ── */
  if (result) return (
    <div className="survey-shell">
      <div className="survey-header">
        <Thermometer size={18} style={{ color: 'var(--teal)' }} />
        <span className="survey-title">Thermal Comfort Analysis</span>
      </div>
      <ComfortResult result={result} onRedo={handleRedo} />
    </div>
  );

  /* ── Question stepper ── */
  return (
    <div className="survey-shell">
      <div className="survey-header">
        <Thermometer size={18} style={{ color: 'var(--teal)' }} />
        <span className="survey-title">Thermal Comfort Questionnaire</span>
        <span className="survey-counter">{step + 1} / {total}</span>
      </div>

      {/* Progress bar */}
      <div className="survey-progress">
        <div className="survey-progress-fill" style={{ width: `${((step + 1) / total) * 100}%` }} />
      </div>

      <div className="survey-content">
        <div className="q-block">
          <h2 className="q-label">{q.label}</h2>
          {q.sub && <p className="q-sub">{q.sub}</p>}

          {q.type === 'card' && (
            <CardOptions
              options={q.options}
              value={answers[q.id]}
              onChange={val => setAnswer(q.id, val)}
            />
          )}
          {q.type === 'scale' && (
            <ScaleInput
              min={q.min} max={q.max} labels={q.labels}
              value={answers[q.id]}
              onChange={val => setAnswer(q.id, val)}
            />
          )}
        </div>

        {error && <div className="auth-alert auth-alert-error">{error}</div>}

        <div className="q-nav">
          <button
            className="q-nav-btn secondary" onClick={goPrev} disabled={step === 0}
            id="q-prev-btn"
          >
            Back
          </button>
          <button
            className="q-nav-btn primary" onClick={goNext} disabled={!canNext || loading}
            id="q-next-btn"
          >
            {loading
              ? <span className="spinner-sm" />
              : step === total - 1 ? 'Analyse' : 'Next'}
            {!loading && step < total - 1 && <ChevronRight size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
