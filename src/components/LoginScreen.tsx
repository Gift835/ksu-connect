import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Eye, EyeOff, Mail, Lock, User, Sparkles } from 'lucide-react';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regFullName, setRegFullName] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return showToast('Please fill all fields', 'error');
    setLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setLoading(false);
    if (error) showToast(error, 'error');
    else showToast('Welcome back! 🎉');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEmail || !regPassword || !regUsername || !regFullName)
      return showToast('Please fill all fields', 'error');
    if (regPassword.length < 6)
      return showToast('Password must be at least 6 characters', 'error');
    if (!/^[a-z0-9_]{3,20}$/.test(regUsername))
      return showToast('Username: 3-20 chars, lowercase, letters/numbers/underscore', 'error');
    setLoading(true);
    const { error } = await signUp(regEmail, regPassword, regUsername, regFullName);
    setLoading(false);
    if (error) showToast(error, 'error');
    else showToast('Account created! Check your email to verify. 🚀');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
    }}>
      {/* Animated orbs */}
      <div style={{
        position: 'fixed', top: '10%', left: '15%', width: 400, height: 400,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,107,107,0.12) 0%, transparent 70%)',
        animation: 'bgPulse 6s ease-in-out infinite alternate', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'fixed', bottom: '10%', right: '10%', width: 500, height: 500,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(78,205,196,0.1) 0%, transparent 70%)',
        animation: 'bgPulse 8s ease-in-out infinite alternate-reverse', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'fixed', top: '40%', right: '25%', width: 300, height: 300,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)',
        animation: 'bgPulse 10s ease-in-out infinite alternate', pointerEvents: 'none'
      }} />

      <div style={{ width: '100%', maxWidth: 460, position: 'relative', zIndex: 1 }}>
        {/* Logo + Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 80, height: 80, borderRadius: '50%', marginBottom: 16,
            background: 'var(--gradient-brand)',
            boxShadow: '0 0 40px rgba(255,107,107,0.4), 0 0 80px rgba(168,85,247,0.2)',
            animation: 'bgPulse 3s ease-in-out infinite alternate',
          }}>
            <Sparkles size={36} color="white" />
          </div>
          <h1 style={{ fontSize: '2.2rem', fontFamily: 'Outfit, sans-serif', marginBottom: 8 }}>
            <span className="gradient-text">KSU CONNECT</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            The social hub for KSU students &amp; community
          </p>
        </div>

        {/* Card */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)' }}>
            {(['login', 'register'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '16px',
                background: tab === t ? 'rgba(255,107,107,0.08)' : 'transparent',
                border: 'none', color: tab === t ? 'var(--coral)' : 'var(--text-muted)',
                fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                borderBottom: tab === t ? '2px solid var(--coral)' : '2px solid transparent',
                transition: 'all 0.2s ease',
              }}>
                {t === 'login' ? '🔑 Sign In' : '✨ Create Account'}
              </button>
            ))}
          </div>

          <div style={{ padding: 32 }}>
            {tab === 'login' ? (
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Email</label>
                  <div className="input-group">
                    <Mail size={16} className="input-icon" />
                    <input className="input" type="email" placeholder="your@email.com"
                      value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Password</label>
                  <div className="input-group" style={{ position: 'relative' }}>
                    <Lock size={16} className="input-icon" />
                    <input className="input" type={showPass ? 'text' : 'password'} placeholder="••••••••"
                      value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                      style={{ paddingRight: 44 }} />
                    <button type="button" onClick={() => setShowPass(!showPass)} style={{
                      position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer'
                    }}>
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading}
                  style={{ marginTop: 8 }}>
                  {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Sign In'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Full Name</label>
                    <div className="input-group">
                      <User size={16} className="input-icon" />
                      <input className="input" type="text" placeholder="John Doe"
                        value={regFullName} onChange={e => setRegFullName(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Username</label>
                    <div className="input-group">
                      <span className="input-icon" style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>@</span>
                      <input className="input" type="text" placeholder="johndoe"
                        value={regUsername} onChange={e => setRegUsername(e.target.value.toLowerCase())} />
                    </div>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Email</label>
                  <div className="input-group">
                    <Mail size={16} className="input-icon" />
                    <input className="input" type="email" placeholder="your@email.com"
                      value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Password</label>
                  <div className="input-group" style={{ position: 'relative' }}>
                    <Lock size={16} className="input-icon" />
                    <input className="input" type={showPass ? 'text' : 'password'} placeholder="Min. 6 characters"
                      value={regPassword} onChange={e => setRegPassword(e.target.value)}
                      style={{ paddingRight: 44 }} />
                    <button type="button" onClick={() => setShowPass(!showPass)} style={{
                      position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer'
                    }}>
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button className="btn btn-gradient btn-lg w-full" type="submit" disabled={loading}
                  style={{ marginTop: 8 }}>
                  {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Create Account ✨'}
                </button>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  By signing up, you agree to KSU Connect's Terms of Service
                </p>
              </form>
            )}
          </div>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 24 }}>
          KSU Connect © 2025 — Connecting the KSU Community
        </p>
      </div>
    </div>
  );
}
