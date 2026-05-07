import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ── Load session on mount ─────────────────────────────── */
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) fetchProfile(session.user.id);
        else setProfile(null);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  /* ── Fetch user profile from our backend ───────────────── */
  async function fetchProfile(userId) {
    try {
      const session = await supabase.auth.getSession();
      const token   = session.data.session?.access_token;
      const API     = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res     = await fetch(`${API}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setProfile(await res.json());
    } catch (e) {
      console.warn('Profile fetch failed:', e.message);
    }
  }

  /* ── Sign Up ────────────────────────────────────────────── */
  async function signUp({ email, password, name }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;

    // If Supabase auto-confirmed (email confirm disabled), we already have a session.
    // If not, try signing in immediately (works when email confirm is OFF in Supabase).
    let session = data.session;
    if (!session) {
      const signInRes = await supabase.auth.signInWithPassword({ email, password });
      if (!signInRes.error) session = signInRes.data.session;
    }

    // Notify backend to create profile row + send welcome email
    const userId = data.user?.id || session?.user?.id;
    if (userId) {
      const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const token = session?.access_token;
      // Send register request with retry — ensures welcome email sends even on cold start
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      try {
        await fetch(`${API}/api/auth/register`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ userId, email, name }),
          signal:  controller.signal,
        });
      } catch { /* backend might be cold — email may not send */ }
      clearTimeout(timeout);
    }
    return data;
  }


  /* ── Sign In ────────────────────────────────────────────── */
  async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  /* ── Sign Out ───────────────────────────────────────────── */
  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  /* ── Refresh profile after update ──────────────────────── */
  async function refreshProfile() {
    if (user) await fetchProfile(user.id);
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
