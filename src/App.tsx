import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import { SettingsProvider } from './context/SettingsContext';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import './index.css';


function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--gradient-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: 'var(--shadow-glow-coral)',
            animation: 'bgPulse 2s ease-in-out infinite alternate',
          }}>
            <span style={{ fontSize: '1.5rem' }}>✨</span>
          </div>
          <p className="gradient-text" style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 700, fontSize: '1.1rem' }}>
            KSU CONNECT
          </p>
          <div className="spinner" style={{ margin: '12px auto 0' }} />
        </div>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  return (
    <SettingsProvider>
      <SubscriptionProvider>
        <Dashboard />
      </SubscriptionProvider>
    </SettingsProvider>
  );
}


export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
