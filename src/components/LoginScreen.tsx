import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, CheckCircle, Zap, Shield, Users, Star } from 'lucide-react';

type View = 'login' | 'register' | 'forgot';

/* Floating animated particle */
interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  hue: number;
  delay: number;
}

function useParticles(count = 18) {
  const [particles] = useState<Particle[]>(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 6 + 3,
      speed: Math.random() * 20 + 15,
      hue: [220, 260, 190, 30, 340][Math.floor(Math.random() * 5)],
      delay: Math.random() * 10,
    }))
  );
  return particles;
}

const FEATURES = [
  { icon: Zap, label: 'Real-time feed & posts' },
  { icon: Users, label: 'Connect with classmates' },
  { icon: Shield, label: 'Safe campus community' },
  { icon: Star, label: 'Live streams & events' },
];

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const { showToast } = useToast();
  const [view, setView] = useState<View>('login');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regFullName, setRegFullName] = useState('');

  // Forgot password form
  const [forgotEmail, setForgotEmail] = useState('');

  const particles = useParticles(20);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return showToast('Please fill all fields', 'error');
    setLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setLoading(false);
    if (error) showToast(error, 'error');
    else showToast('Welcome back! 🎉', 'success');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEmail || !regPassword || !regUsername || !regFullName)
      return showToast('Please fill all fields', 'error');
    if (regPassword.length < 6)
      return showToast('Password must be at least 6 characters', 'error');
    if (!/^[a-z0-9_]{3,20}$/.test(regUsername))
      return showToast('Username: 3–20 chars, lowercase letters/numbers/underscore', 'error');
    setLoading(true);
    const { error } = await signUp(regEmail, regPassword, regUsername, regFullName);
    setLoading(false);
    if (error) showToast(error, 'error');
    else showToast('Account created! Check your email to verify. 🚀', 'success');
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return showToast('Enter your email address', 'error');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if (error) {
      showToast(error.message, 'error');
    } else {
      setForgotSent(true);
    }
  };

  return (
    <div className="login-root">
      {/* Animated floating particles */}
      <div className="login-particles" aria-hidden>
        {particles.map(p => (
          <div
            key={p.id}
            className="login-particle"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              animationDuration: `${p.speed}s`,
              animationDelay: `${p.delay}s`,
              background: `hsl(${p.hue}, 80%, 65%)`,
              boxShadow: `0 0 ${p.size * 3}px hsl(${p.hue}, 80%, 65%)`,
            }}
          />
        ))}
      </div>

      {/* Large gradient orbs */}
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />
      <div className="login-orb login-orb-3" />

      {/* Main layout: split panel */}
      <div className="login-layout">

        {/* Left: Brand panel */}
        <div className="login-brand-panel">
          <div className="login-brand-inner">
            {/* Logo */}
            <div className="login-logo">
              <div className="login-logo-icon">
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                  <path d="M18 3L32 10.5V25.5L18 33L4 25.5V10.5L18 3Z" fill="white" fillOpacity="0.9" />
                  <path d="M18 8L28 13.5V24.5L18 30L8 24.5V13.5L18 8Z" fill="white" fillOpacity="0.15" />
                  <circle cx="18" cy="18" r="5" fill="white" />
                </svg>
              </div>
              <div className="login-logo-text">
                <span>KSU</span>
                <span className="logo-connect">CONNECT</span>
              </div>
            </div>

            <h2 className="login-brand-headline">
              Your Campus,<br />Your Community.
            </h2>
            <p className="login-brand-sub">
              The ultimate social platform for Kogi State University students. Connect, share, and thrive together.
            </p>

            {/* Feature pills */}
            <div className="login-features">
              {FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} className="login-feature-pill">
                  <Icon size={15} />
                  <span>{label}</span>
                </div>
              ))}
            </div>

            {/* Floating stat cards */}
            <div className="login-stat-cards">
              <div className="login-stat-card">
                <span className="stat-num">5K+</span>
                <span className="stat-label">Students</span>
              </div>
              <div className="login-stat-card">
                <span className="stat-num">100+</span>
                <span className="stat-label">Daily posts</span>
              </div>
              <div className="login-stat-card">
                <span className="stat-num">Live</span>
                <span className="stat-label">Streams</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Auth form panel */}
        <div className="login-form-panel">
          <div className="login-form-container">

            {/* Tab switcher (only on login/register) */}
            {view !== 'forgot' && (
              <div className="login-tabs">
                <button
                  className={`login-tab ${view === 'login' ? 'active' : ''}`}
                  onClick={() => setView('login')}
                >
                  Sign In
                </button>
                <button
                  className={`login-tab ${view === 'register' ? 'active' : ''}`}
                  onClick={() => setView('register')}
                >
                  Create Account
                </button>
                <div
                  className="login-tab-slider"
                  style={{ transform: view === 'register' ? 'translateX(100%)' : 'translateX(0)' }}
                />
              </div>
            )}

            {/* ===== SIGN IN FORM ===== */}
            {view === 'login' && (
              <div className="login-form-body">
                <div className="login-form-header">
                  <h1>Welcome back 👋</h1>
                  <p>Sign in to your KSU Connect account</p>
                </div>
                <form onSubmit={handleLogin} className="login-form">
                  <div className="lf-field">
                    <label>Email address</label>
                    <div className="lf-input-wrap">
                      <Mail size={17} className="lf-icon" />
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={loginEmail}
                        onChange={e => setLoginEmail(e.target.value)}
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div className="lf-field">
                    <label>Password</label>
                    <div className="lf-input-wrap">
                      <Lock size={17} className="lf-icon" />
                      <input
                        type={showPass ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={e => setLoginPassword(e.target.value)}
                        autoComplete="current-password"
                        style={{ paddingRight: 44 }}
                      />
                      <button type="button" className="lf-eye" onClick={() => setShowPass(!showPass)}>
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Forgot password link */}
                  <div style={{ textAlign: 'right', marginTop: -8 }}>
                    <button
                      type="button"
                      className="forgot-link"
                      onClick={() => { setForgotEmail(loginEmail); setView('forgot'); setForgotSent(false); }}
                    >
                      Forgot password?
                    </button>
                  </div>

                  <button type="submit" className="lf-btn-primary" disabled={loading}>
                    {loading
                      ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                      : <>Sign In <span className="btn-arrow">→</span></>
                    }
                  </button>
                </form>

                <p className="login-switch-hint">
                  New to KSU Connect?{' '}
                  <button onClick={() => setView('register')}>Create a free account</button>
                </p>
              </div>
            )}

            {/* ===== REGISTER FORM ===== */}
            {view === 'register' && (
              <div className="login-form-body">
                <div className="login-form-header">
                  <h1>Join KSU Connect ✨</h1>
                  <p>Create your free account in seconds</p>
                </div>
                <form onSubmit={handleRegister} className="login-form">
                  <div className="lf-row-2">
                    <div className="lf-field">
                      <label>Full Name</label>
                      <div className="lf-input-wrap">
                        <User size={17} className="lf-icon" />
                        <input
                          type="text"
                          placeholder="John Doe"
                          value={regFullName}
                          onChange={e => setRegFullName(e.target.value)}
                          autoComplete="name"
                        />
                      </div>
                    </div>
                    <div className="lf-field">
                      <label>Username</label>
                      <div className="lf-input-wrap">
                        <span className="lf-icon lf-at">@</span>
                        <input
                          type="text"
                          placeholder="johndoe"
                          value={regUsername}
                          onChange={e => setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                          autoComplete="username"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="lf-field">
                    <label>Email address</label>
                    <div className="lf-input-wrap">
                      <Mail size={17} className="lf-icon" />
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={regEmail}
                        onChange={e => setRegEmail(e.target.value)}
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div className="lf-field">
                    <label>Password</label>
                    <div className="lf-input-wrap">
                      <Lock size={17} className="lf-icon" />
                      <input
                        type={showPass2 ? 'text' : 'password'}
                        placeholder="Min. 6 characters"
                        value={regPassword}
                        onChange={e => setRegPassword(e.target.value)}
                        autoComplete="new-password"
                        style={{ paddingRight: 44 }}
                      />
                      <button type="button" className="lf-eye" onClick={() => setShowPass2(!showPass2)}>
                        {showPass2 ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {/* Password strength bar */}
                    {regPassword.length > 0 && (
                      <div className="pwd-strength">
                        {[...Array(4)].map((_, i) => (
                          <div
                            key={i}
                            className={`pwd-bar ${i < Math.min(4, Math.floor(regPassword.length / 2)) ? 'filled' : ''}`}
                            style={{
                              background: i < Math.min(4, Math.floor(regPassword.length / 2))
                                ? regPassword.length < 6 ? '#ef4444'
                                  : regPassword.length < 10 ? '#f59e0b'
                                    : '#22c55e'
                                : undefined
                            }}
                          />
                        ))}
                        <span className="pwd-label">
                          {regPassword.length < 6 ? 'Too short' : regPassword.length < 10 ? 'Good' : 'Strong'}
                        </span>
                      </div>
                    )}
                  </div>

                  <button type="submit" className="lf-btn-primary lf-btn-register" disabled={loading}>
                    {loading
                      ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                      : <>Create Account ✨</>
                    }
                  </button>

                  <p className="lf-terms">
                    By signing up you agree to KSU Connect's{' '}
                    <span>Terms of Service</span> and <span>Community Guidelines</span>
                  </p>
                </form>

                <p className="login-switch-hint">
                  Already have an account?{' '}
                  <button onClick={() => setView('login')}>Sign in here</button>
                </p>
              </div>
            )}

            {/* ===== FORGOT PASSWORD FORM ===== */}
            {view === 'forgot' && (
              <div className="login-form-body">
                <button className="forgot-back-btn" onClick={() => setView('login')}>
                  <ArrowLeft size={16} /> Back to Sign In
                </button>

                {!forgotSent ? (
                  <>
                    <div className="login-form-header">
                      <div className="forgot-icon-wrap">
                        <Lock size={28} />
                      </div>
                      <h1>Reset Password</h1>
                      <p>Enter your email and we'll send you a link to reset your password</p>
                    </div>
                    <form onSubmit={handleForgotPassword} className="login-form">
                      <div className="lf-field">
                        <label>Email address</label>
                        <div className="lf-input-wrap">
                          <Mail size={17} className="lf-icon" />
                          <input
                            type="email"
                            placeholder="your@email.com"
                            value={forgotEmail}
                            onChange={e => setForgotEmail(e.target.value)}
                            autoComplete="email"
                          />
                        </div>
                      </div>

                      <button type="submit" className="lf-btn-primary" disabled={loading}>
                        {loading
                          ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                          : 'Send Reset Link 📧'
                        }
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="forgot-success">
                    <div className="forgot-success-icon">
                      <CheckCircle size={48} />
                    </div>
                    <h2>Check your email!</h2>
                    <p>
                      We sent a password reset link to<br />
                      <strong>{forgotEmail}</strong>
                    </p>
                    <p className="forgot-hint">
                      Didn't receive it? Check your spam folder or{' '}
                      <button onClick={() => setForgotSent(false)}>try again</button>
                    </p>
                    <button
                      className="lf-btn-primary"
                      style={{ marginTop: 24, width: '100%' }}
                      onClick={() => setView('login')}
                    >
                      Back to Sign In
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>

          <p className="login-footer">KSU Connect © 2026 — Connecting the KSU Community</p>
        </div>
      </div>
    </div>
  );
}
