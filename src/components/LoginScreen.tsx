import React, { useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Eye, EyeOff, Mail, Lock, User, ArrowLeft,
  CheckCircle, Zap, Users, Shield, Sparkles, BookOpen, Radio
} from 'lucide-react';

type View = 'login' | 'register' | 'forgot';

/* ── animation variants ── */
const easeOut = [0.25, 0.46, 0.45, 0.94] as [number, number, number, number];

const pageVariants: Variants = {
  initial: { opacity: 0, y: 24, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: easeOut } },
  exit:    { opacity: 0, y: -16, scale: 0.98, transition: { duration: 0.22, ease: easeOut } },
};

const stagger: Variants = {
  animate: { transition: { staggerChildren: 0.07 } },
};

const fadeUp: Variants = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

const orbVariants = {
  animate: (i: number) => ({
    x: [0, 30 * (i % 2 === 0 ? 1 : -1), 0],
    y: [0, -40, 0],
    scale: [1, 1.08, 1],
    transition: { duration: 10 + i * 2.5, repeat: Infinity, ease: 'easeInOut' as const },
  }),
};

/* ── Password strength helper ── */
function pwdStrength(pw: string): { score: number; label: string; color: string } {
  const len = pw.length;
  if (!len) return { score: 0, label: '', color: '#e2e8f0' };
  if (len < 6)  return { score: 1, label: 'Too short', color: '#f87171' };
  if (len < 9)  return { score: 2, label: 'Fair',      color: '#fb923c' };
  if (len < 12) return { score: 3, label: 'Good',      color: '#34d399' };
  return         { score: 4, label: 'Strong 🔥',   color: '#6366f1' };
}

/* ── Feature items ── */
const FEATURES = [
  { icon: Zap,       label: 'Real-time feed & posts',     color: '#6366f1' },
  { icon: Users,     label: 'Connect with classmates',    color: '#f43f5e' },
  { icon: Radio,     label: 'Go live & watch streams',    color: '#8b5cf6' },
  { icon: BookOpen,  label: 'Campus events & news',       color: '#06b6d4' },
  { icon: Shield,    label: 'Safe verified community',    color: '#10b981' },
  { icon: Sparkles,  label: 'Premium creator features',   color: '#f59e0b' },
];

/* ── Floating shapes (background decoration) ── */
const SHAPES = [
  { size: 340, top: '-8%',  left: '-6%',  color: 'rgba(99,102,241,0.12)'  },
  { size: 260, top: '60%',  left: '-4%',  color: 'rgba(244,63,94,0.08)'   },
  { size: 300, top: '-5%',  right: '-4%', color: 'rgba(139,92,246,0.10)'  },
  { size: 200, top: '72%',  right: '-2%', color: 'rgba(6,182,212,0.08)'   },
  { size: 180, top: '42%',  left: '42%',  color: 'rgba(251,191,36,0.07)'  },
];

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════ */
export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const { showToast } = useToast();

  const [view, setView]           = useState<View>('login');
  const [loading, setLoading]     = useState(false);
  const [showPass, setShowPass]   = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  /* login form */
  const [loginEmail, setLoginEmail]       = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  /* register form */
  const [regEmail,    setRegEmail]    = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regFullName, setRegFullName] = useState('');

  /* forgot */
  const [forgotEmail, setForgotEmail] = useState('');

  const strength = pwdStrength(regPassword);

  /* ── handlers ── */
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
    else showToast('Account created! Check your email ✉️', 'success');
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return showToast('Enter your email address', 'error');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if (error) showToast(error.message, 'error');
    else setForgotSent(true);
  };

  const switchView = (v: View) => {
    setLoading(false);
    setForgotSent(false);
    setView(v);
  };

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div style={styles.root} data-login-root>

      {/* ── animated blob background ── */}
      {SHAPES.map((s, i) => (
        <motion.div
          key={i}
          custom={i}
          variants={orbVariants}
          animate="animate"
          style={{
            position: 'fixed',
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            background: s.color,
            filter: 'blur(70px)',
            pointerEvents: 'none',
            zIndex: 0,
            top: (s as any).top,
            left: (s as any).left,
            right: (s as any).right,
          }}
        />
      ))}

      {/* ── mesh grid overlay ── */}
      <div style={styles.meshGrid} />

      {/* ══ LAYOUT ══ */}
      <div style={styles.layout} data-login-layout>

        {/* ════ LEFT PANEL — brand ════ */}
        <motion.div
          style={styles.brandPanel}
          data-login-brand
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {/* Logo */}
          <motion.div
            style={styles.logoRow}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <div style={styles.logoIcon}>
              <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
                <path d="M18 3L32 10.5V25.5L18 33L4 25.5V10.5L18 3Z" fill="white" fillOpacity="0.95" />
                <circle cx="18" cy="18" r="5.5" fill="rgba(99,102,241,0.9)" />
              </svg>
            </div>
            <div>
              <div style={styles.logoName}>KSU Connect</div>
              <div style={styles.logoSub}>Campus Social Hub</div>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            style={styles.headline}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            Your Campus,<br />
            <span style={styles.headlineAccent}>Alive.</span>
          </motion.h1>

          <motion.p
            style={styles.tagline}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.5 }}
          >
            The premier social platform built exclusively for Kogi State University students. Connect, create, and thrive.
          </motion.p>

          {/* Feature list */}
          <motion.div
            style={styles.featureList}
            variants={stagger}
            initial="initial"
            animate="animate"
          >
            {FEATURES.map(({ icon: Icon, label, color }) => (
              <motion.div key={label} style={styles.featureItem} variants={fadeUp}>
                <div style={{ ...styles.featureIconBox, background: color + '18', border: `1px solid ${color}30` }}>
                  <Icon size={15} color={color} />
                </div>
                <span style={styles.featureLabel}>{label}</span>
              </motion.div>
            ))}
          </motion.div>

          {/* Stats */}
          <motion.div
            style={styles.statsRow}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
          >
            {[
              { n: '5K+',  l: 'Students'   },
              { n: '100+', l: 'Daily Posts' },
              { n: 'Live', l: 'Streams'     },
            ].map(({ n, l }) => (
              <div key={l} style={styles.statCard}>
                <span style={styles.statNum}>{n}</span>
                <span style={styles.statLabel}>{l}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* ════ RIGHT PANEL — form ════ */}
        <motion.div
          style={styles.formPanel}
          data-login-form
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <div style={styles.formCard} data-form-card>

            {/* Tab switcher (login / register only) */}
            {view !== 'forgot' && (
              <div style={styles.tabRow}>
                {(['login', 'register'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => switchView(t)}
                    style={{
                      ...styles.tab,
                      ...(view === t ? styles.tabActive : {}),
                    }}
                  >
                    {t === 'login' ? 'Sign In' : 'Create Account'}
                  </button>
                ))}
                <motion.div
                  style={styles.tabSlider}
                  animate={{ x: view === 'register' ? '100%' : '0%' }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              </div>
            )}

            {/* ── FORMS ── */}
            <AnimatePresence mode="wait">

              {/* ══ SIGN IN ══ */}
              {view === 'login' && (
                <motion.div key="login" variants={pageVariants} initial="initial" animate="animate" exit="exit">
                  <motion.div variants={stagger} initial="initial" animate="animate">
                    <motion.div variants={fadeUp} style={styles.formHeader}>
                      <h2 style={styles.formTitle}>Welcome back 👋</h2>
                      <p style={styles.formSub}>Sign in to your KSU Connect account</p>
                    </motion.div>

                    <form onSubmit={handleLogin} style={styles.form}>
                      <motion.div variants={fadeUp}>
                        <Field label="Email address" icon={<Mail size={16} color="#6366f1" />}>
                          <input
                            style={styles.input}
                            type="email"
                            placeholder="your@email.com"
                            value={loginEmail}
                            onChange={e => setLoginEmail(e.target.value)}
                            autoComplete="email"
                          />
                        </Field>
                      </motion.div>

                      <motion.div variants={fadeUp}>
                        <Field label="Password" icon={<Lock size={16} color="#6366f1" />}>
                          <input
                            style={styles.input}
                            type={showPass ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={loginPassword}
                            onChange={e => setLoginPassword(e.target.value)}
                            autoComplete="current-password"
                          />
                          <EyeToggle show={showPass} toggle={() => setShowPass(!showPass)} />
                        </Field>
                      </motion.div>

                      <motion.div variants={fadeUp} style={{ textAlign: 'right', marginTop: -6 }}>
                        <button
                          type="button"
                          style={styles.forgotLink}
                          onClick={() => { setForgotEmail(loginEmail); switchView('forgot'); }}
                        >
                          Forgot password?
                        </button>
                      </motion.div>

                      <motion.div variants={fadeUp}>
                        <SubmitBtn loading={loading}>Sign In →</SubmitBtn>
                      </motion.div>
                    </form>

                    <motion.p variants={fadeUp} style={styles.switchHint}>
                      New here?{' '}
                      <button style={styles.switchLink} onClick={() => switchView('register')}>
                        Create a free account
                      </button>
                    </motion.p>
                  </motion.div>
                </motion.div>
              )}

              {/* ══ REGISTER ══ */}
              {view === 'register' && (
                <motion.div key="register" variants={pageVariants} initial="initial" animate="animate" exit="exit">
                  <motion.div variants={stagger} initial="initial" animate="animate">
                    <motion.div variants={fadeUp} style={styles.formHeader}>
                      <h2 style={styles.formTitle}>Join KSU Connect ✨</h2>
                      <p style={styles.formSub}>Create your free account in seconds</p>
                    </motion.div>

                    <form onSubmit={handleRegister} style={styles.form}>
                      {/* Name + Username row */}
                      <motion.div variants={fadeUp} style={styles.row2} data-row2>
                        <Field label="Full Name" icon={<User size={16} color="#6366f1" />}>
                          <input
                            style={styles.input}
                            type="text"
                            placeholder="John Doe"
                            value={regFullName}
                            onChange={e => setRegFullName(e.target.value)}
                            autoComplete="name"
                          />
                        </Field>
                        <Field label="Username" icon={<span style={styles.atIcon}>@</span>}>
                          <input
                            style={styles.input}
                            type="text"
                            placeholder="johndoe"
                            value={regUsername}
                            onChange={e => setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                            autoComplete="username"
                          />
                        </Field>
                      </motion.div>

                      <motion.div variants={fadeUp}>
                        <Field label="Email address" icon={<Mail size={16} color="#6366f1" />}>
                          <input
                            style={styles.input}
                            type="email"
                            placeholder="your@email.com"
                            value={regEmail}
                            onChange={e => setRegEmail(e.target.value)}
                            autoComplete="email"
                          />
                        </Field>
                      </motion.div>

                      <motion.div variants={fadeUp}>
                        <Field label="Password" icon={<Lock size={16} color="#6366f1" />}>
                          <input
                            style={styles.input}
                            type={showPass2 ? 'text' : 'password'}
                            placeholder="Min. 6 characters"
                            value={regPassword}
                            onChange={e => setRegPassword(e.target.value)}
                            autoComplete="new-password"
                          />
                          <EyeToggle show={showPass2} toggle={() => setShowPass2(!showPass2)} />
                        </Field>

                        {/* Strength bar */}
                        <AnimatePresence>
                          {regPassword.length > 0 && (
                            <motion.div
                              style={styles.strengthRow}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                            >
                              {[1, 2, 3, 4].map(i => (
                                <motion.div
                                  key={i}
                                  style={styles.strengthBar}
                                  animate={{ background: i <= strength.score ? strength.color : '#e2e8f0' }}
                                  transition={{ duration: 0.3 }}
                                />
                              ))}
                              <span style={{ ...styles.strengthLabel, color: strength.color }}>
                                {strength.label}
                              </span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>

                      <motion.div variants={fadeUp}>
                        <SubmitBtn loading={loading} gradient="purple">Create Account ✨</SubmitBtn>
                      </motion.div>

                      <motion.p variants={fadeUp} style={styles.termsText}>
                        By signing up you agree to our{' '}
                        <span style={styles.termsLink}>Terms of Service</span> &{' '}
                        <span style={styles.termsLink}>Community Guidelines</span>
                      </motion.p>
                    </form>

                    <p style={styles.switchHint}>
                      Already have an account?{' '}
                      <button style={styles.switchLink} onClick={() => switchView('login')}>
                        Sign in here
                      </button>
                    </p>
                  </motion.div>
                </motion.div>
              )}

              {/* ══ FORGOT PASSWORD ══ */}
              {view === 'forgot' && (
                <motion.div key="forgot" variants={pageVariants} initial="initial" animate="animate" exit="exit">
                  <motion.div variants={stagger} initial="initial" animate="animate">

                    <motion.button
                      variants={fadeUp}
                      style={styles.backBtn}
                      onClick={() => switchView('login')}
                      whileHover={{ x: -3 }}
                    >
                      <ArrowLeft size={15} /> Back to Sign In
                    </motion.button>

                    {!forgotSent ? (
                      <>
                        <motion.div variants={fadeUp} style={styles.formHeader}>
                          <motion.div
                            style={styles.forgotIconBox}
                            animate={{ rotate: [0, -8, 8, -4, 0] }}
                            transition={{ delay: 0.3, duration: 0.5 }}
                          >
                            <Lock size={26} color="#6366f1" />
                          </motion.div>
                          <h2 style={styles.formTitle}>Reset Password</h2>
                          <p style={styles.formSub}>
                            Enter your email and we'll send a reset link instantly
                          </p>
                        </motion.div>

                        <form onSubmit={handleForgot} style={styles.form}>
                          <motion.div variants={fadeUp}>
                            <Field label="Email address" icon={<Mail size={16} color="#6366f1" />}>
                              <input
                                style={styles.input}
                                type="email"
                                placeholder="your@email.com"
                                value={forgotEmail}
                                onChange={e => setForgotEmail(e.target.value)}
                                autoComplete="email"
                              />
                            </Field>
                          </motion.div>
                          <motion.div variants={fadeUp}>
                            <SubmitBtn loading={loading}>Send Reset Link 📧</SubmitBtn>
                          </motion.div>
                        </form>
                      </>
                    ) : (
                      <motion.div
                        style={styles.successBox}
                        variants={stagger}
                        initial="initial"
                        animate="animate"
                      >
                        <motion.div
                          variants={fadeUp}
                          style={styles.successIcon}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
                        >
                          <CheckCircle size={44} color="#10b981" />
                        </motion.div>
                        <motion.h2 variants={fadeUp} style={{ ...styles.formTitle, textAlign: 'center' }}>
                          Check your inbox!
                        </motion.h2>
                        <motion.p variants={fadeUp} style={{ ...styles.formSub, textAlign: 'center' }}>
                          We sent a password reset link to<br />
                          <strong style={{ color: '#1e293b' }}>{forgotEmail}</strong>
                        </motion.p>
                        <motion.p variants={fadeUp} style={styles.resendHint}>
                          Didn't receive it?{' '}
                          <button style={styles.switchLink} onClick={() => setForgotSent(false)}>
                            Try again
                          </button>
                        </motion.p>
                        <motion.div variants={fadeUp}>
                          <SubmitBtn loading={false} onClick={() => switchView('login')}>
                            Back to Sign In
                          </SubmitBtn>
                        </motion.div>
                      </motion.div>
                    )}
                  </motion.div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          <p style={styles.footer}>KSU Connect © 2026 · Kogi State University Community</p>
        </motion.div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   SHARED SUB-COMPONENTS
═══════════════════════════════════════ */
function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={styles.fieldWrap}>
      <label style={styles.label}>{label}</label>
      <div style={styles.inputWrap}>
        <span style={styles.inputIcon}>{icon}</span>
        {children}
      </div>
    </div>
  );
}

function EyeToggle({ show, toggle }: { show: boolean; toggle: () => void }) {
  return (
    <motion.button
      type="button"
      style={styles.eyeBtn}
      onClick={toggle}
      whileTap={{ scale: 0.88 }}
    >
      {show ? <EyeOff size={16} /> : <Eye size={16} />}
    </motion.button>
  );
}

function SubmitBtn({
  children, loading, gradient, onClick
}: {
  children: React.ReactNode;
  loading: boolean;
  gradient?: 'indigo' | 'purple';
  onClick?: () => void;
}) {
  const bg = gradient === 'purple'
    ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 50%, #3b82f6 100%)'
    : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)';

  return (
    <motion.button
      type={onClick ? 'button' : 'submit'}
      style={{ ...styles.submitBtn, background: bg }}
      disabled={loading}
      onClick={onClick}
      whileHover={loading ? {} : { scale: 1.02, boxShadow: '0 12px 40px rgba(99,102,241,0.45)' }}
      whileTap={loading ? {} : { scale: 0.97 }}
    >
      {loading
        ? <div style={styles.spinner} />
        : children
      }
    </motion.button>
  );
}

/* ═══════════════════════════════════════
   STYLES  (pure light mode)
═══════════════════════════════════════ */
const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: 'linear-gradient(145deg, #f8f7ff 0%, #fdf4ff 30%, #f0f9ff 60%, #fff7ed 100%)',
    display: 'flex',
    alignItems: 'stretch',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Inter', sans-serif",
  },

  meshGrid: {
    position: 'fixed',
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)
    `,
    backgroundSize: '48px 48px',
    pointerEvents: 'none',
    zIndex: 0,
  },

  layout: {
    display: 'grid',
    width: '100%',
    minHeight: '100dvh' as any,
    position: 'relative',
    zIndex: 1,
  },

  /* ── Brand Panel ── */
  brandPanel: {
    padding: '56px 48px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    background: 'linear-gradient(160deg, rgba(99,102,241,0.06) 0%, rgba(139,92,246,0.04) 50%, rgba(244,63,94,0.03) 100%)',
    borderRight: '1px solid rgba(99,102,241,0.1)',
    position: 'relative',
    overflow: 'hidden',
  },

  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 44,
  },

  logoIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 28px rgba(99,102,241,0.35)',
    flexShrink: 0,
  },

  logoName: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: '1.35rem',
    fontWeight: 800,
    color: '#1e1b4b',
    lineHeight: 1.1,
  },

  logoSub: {
    fontSize: '0.72rem',
    color: '#6366f1',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginTop: 2,
  },

  headline: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: '3rem',
    fontWeight: 900,
    lineHeight: 1.15,
    color: '#1e1b4b',
    letterSpacing: '-1px',
    marginBottom: 16,
  },

  headlineAccent: {
    background: 'linear-gradient(90deg, #6366f1, #f43f5e)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },

  tagline: {
    fontSize: '0.97rem',
    color: '#475569',
    lineHeight: 1.65,
    marginBottom: 36,
    maxWidth: 380,
  },

  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 40,
  },

  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },

  featureIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  featureLabel: {
    fontSize: '0.88rem',
    color: '#334155',
    fontWeight: 500,
  },

  statsRow: {
    display: 'flex',
    gap: 12,
  },

  statCard: {
    flex: 1,
    background: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(99,102,241,0.12)',
    borderRadius: 16,
    padding: '14px 12px',
    textAlign: 'center',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 2px 12px rgba(99,102,241,0.06)',
  },

  statNum: {
    display: 'block',
    fontFamily: "'Outfit', sans-serif",
    fontSize: '1.4rem',
    fontWeight: 800,
    background: 'linear-gradient(135deg, #6366f1, #f43f5e)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },

  statLabel: {
    display: 'block',
    fontSize: '0.7rem',
    color: '#64748b',
    fontWeight: 500,
    marginTop: 2,
  },

  /* ── Form Panel ── */
  formPanel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 40px',
    background: 'rgba(255,255,255,0.55)',
    backdropFilter: 'blur(24px)',
    position: 'relative',
  },

  formCard: {
    width: '100%',
    maxWidth: 420,
    background: 'rgba(255,255,255,0.92)',
    borderRadius: 28,
    padding: '36px 36px 28px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.03), 0 20px 60px rgba(99,102,241,0.1), 0 0 0 1px rgba(99,102,241,0.08)',
    border: '1px solid rgba(255,255,255,0.9)',
  },

  /* tabs */
  tabRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    background: '#f1f5f9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 28,
    position: 'relative',
  },

  tab: {
    padding: '10px 14px',
    border: 'none',
    background: 'transparent',
    color: '#64748b',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
    borderRadius: 10,
    position: 'relative',
    zIndex: 2,
    fontFamily: "'Inter', sans-serif",
    transition: 'color 0.2s',
  },

  tabActive: {
    color: '#ffffff',
  },

  tabSlider: {
    position: 'absolute',
    top: 4, left: 4,
    width: 'calc(50% - 4px)',
    height: 'calc(100% - 8px)',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    borderRadius: 10,
    zIndex: 1,
    boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
  },

  /* form internals */
  formHeader: {
    marginBottom: 22,
  },

  formTitle: {
    fontFamily: "'Outfit', sans-serif",
    fontSize: '1.65rem',
    fontWeight: 800,
    color: '#1e1b4b',
    marginBottom: 5,
  },

  formSub: {
    fontSize: '0.875rem',
    color: '#64748b',
  },

  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },

  row2: { /* data-row2 handled in CSS */
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },

  fieldWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },

  label: {
    fontSize: '0.77rem',
    fontWeight: 700,
    color: '#374151',
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
  },

  inputWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },

  inputIcon: {
    position: 'absolute',
    left: 14,
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
    zIndex: 2,
  },

  atIcon: {
    fontSize: '0.95rem',
    fontWeight: 800,
    color: '#6366f1',
  },

  input: { /* focus handled by [data-login-root] input:focus in CSS */
    width: '100%',
    padding: '11px 44px 11px 42px',
    background: '#f8fafc',
    border: '1.5px solid #e2e8f0',
    borderRadius: 12,
    fontSize: 16,
    color: '#1e293b',
    fontFamily: "'Inter', sans-serif",
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
    boxSizing: 'border-box' as const,
  },

  eyeBtn: {
    position: 'absolute',
    right: 12,
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: 4,
    zIndex: 2,
  },

  strengthRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    overflow: 'hidden',
  },

  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 99,
    transition: 'background 0.3s',
  },

  strengthLabel: {
    fontSize: '0.72rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    minWidth: 60,
  },

  submitBtn: {
    width: '100%',
    padding: '13px 24px',
    border: 'none',
    borderRadius: 13,
    color: '#fff',
    fontSize: '0.95rem',
    fontWeight: 700,
    fontFamily: "'Inter', sans-serif",
    cursor: 'pointer',
    boxShadow: '0 6px 24px rgba(99,102,241,0.35)',
    marginTop: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
  },

  spinner: {
    width: 20,
    height: 20,
    border: '2.5px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },

  forgotLink: {
    background: 'none',
    border: 'none',
    color: '#6366f1',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
    fontFamily: "'Inter', sans-serif",
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  },

  switchHint: {
    textAlign: 'center',
    fontSize: '0.84rem',
    color: '#64748b',
    marginTop: 18,
  },

  switchLink: {
    background: 'none',
    border: 'none',
    color: '#6366f1',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: '0.84rem',
    fontFamily: "'Inter', sans-serif",
    padding: 0,
  },

  termsText: {
    fontSize: '0.73rem',
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 1.5,
    marginTop: -6,
  },

  termsLink: {
    color: '#6366f1',
    cursor: 'pointer',
    fontWeight: 600,
  },

  /* forgot */
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'none',
    border: 'none',
    color: '#64748b',
    fontSize: '0.84rem',
    fontWeight: 500,
    cursor: 'pointer',
    padding: 0,
    marginBottom: 24,
    fontFamily: "'Inter', sans-serif",
  },

  forgotIconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    background: 'rgba(99,102,241,0.08)',
    border: '1px solid rgba(99,102,241,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  /* success state */
  successBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
  },

  successIcon: {
    width: 88,
    height: 88,
    borderRadius: '50%',
    background: 'rgba(16,185,129,0.1)',
    border: '2px solid rgba(16,185,129,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  resendHint: {
    fontSize: '0.8rem',
    color: '#94a3b8',
    textAlign: 'center',
  },

  footer: {
    marginTop: 20,
    fontSize: '0.73rem',
    color: '#94a3b8',
    textAlign: 'center',
  },
};
