import React, { useState, useEffect } from 'react';
import { Home, Compass, Bell, MessageCircle, User, TrendingUp, Users, LogOut, CreditCard, Shield, Crown, Settings as SettingsIcon, Download } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';

interface SidebarProps {
  activePage: string;
  setActivePage: (p: string) => void;
  unreadNotifs: number;
  unreadMessages: number;
}

export default function Sidebar({ activePage, setActivePage, unreadNotifs, unreadMessages }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const { isActive } = useSubscription();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstallable(false);
      }
    } else {
      // Fallback for browsers that don't support beforeinstallprompt
      alert('To install KSU Connect:\n\n📱 Android: Open in Chrome → Menu → "Install app" or "Add to Home screen"\n💻 Desktop: Open in Chrome → 🔒 (lock icon) → "Install KSU Connect"\n\nOr simply use the browser bookmark!');
    }
  };
  const initials = profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    || profile?.username?.[0]?.toUpperCase() || '?';

  const navItems = [
    { id: 'feed', icon: Home, label: 'Home Feed' },
    { id: 'explore', icon: Compass, label: 'Explore' },
    { id: 'notifications', icon: Bell, label: 'Notifications' },
    { id: 'messages', icon: MessageCircle, label: 'Messages' },
    { id: 'profile', icon: User, label: 'My Profile' },
    { id: 'trending', icon: TrendingUp, label: 'Trending' },
    { id: 'people', icon: Users, label: 'People' },
    { id: 'premium', icon: isActive ? Crown : CreditCard, label: isActive ? 'Premium' : 'Go Premium' },
    ...(profile?.is_admin ? [{ id: 'admin', icon: Shield, label: 'Admin Panel' }] : []),
    { id: 'settings', icon: SettingsIcon, label: 'Settings' },
  ];


  const getBadge = (id: string) => {
    if (id === 'notifications') return unreadNotifs;
    if (id === 'messages') return unreadMessages;
    return 0;
  };

  return (
    <aside className="app-sidebar">
      <div style={{
        padding: '16px', marginBottom: 8,
        background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
        borderRadius: 'var(--border-radius-md)',
        display: 'flex', alignItems: 'center', gap: 10,
        cursor: 'pointer'
      }} onClick={() => setActivePage('profile')}>
        <div className="avatar-ring" style={{ padding: 2 }}>
          {profile?.avatar_url
            ? <img src={profile.avatar_url} className="avatar avatar-md" alt="you" />
            : <div className="avatar-placeholder avatar-md" style={{ fontSize: '1rem', border: '2px solid var(--bg-primary)' }}>{initials}</div>}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="truncate">{profile?.full_name || profile?.username}</span>
            {profile?.is_verified && <span style={{ color: 'var(--neon-blue)', fontSize: '0.75rem', flexShrink: 0 }}>✓</span>}
            {profile?.is_admin && <Crown size={11} color="var(--neon-blue)" />}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{profile?.username}</div>
        </div>
        {isActive && (
          <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(76, 201, 240, 0.15)', color: 'var(--neon-blue)', fontSize: '0.65rem', fontWeight: 700 }}>
            PRO
          </span>
        )}
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(({ id, icon: Icon, label }) => {
          const badge = getBadge(id);
          const isActive = activePage === id || activePage.startsWith(`${id}:`);
          const isPremiumLink = id === 'premium';
          const isAdminLink = id === 'admin';
          return (
            <button key={id} className={`nav-item ${isActive ? 'active' : ''} ${isAdminLink ? 'admin-link' : ''}`}
              onClick={() => setActivePage(id)}
              style={isPremiumLink ? {
                background: 'var(--gradient-brand)',
                color: 'white',
                fontWeight: 700,
                marginTop: 8,
              } : isAdminLink ? {
                background: 'rgba(76, 201, 240, 0.08)',
                border: '1px solid rgba(76, 201, 240, 0.2)',
                marginTop: 8,
              } : undefined}
            >
              <Icon size={20} />
              <span style={{ fontSize: '0.9rem' }}>{label}</span>
              {badge > 0 && <span className="nav-badge">{badge > 99 ? '99+' : badge}</span>}
            </button>
          );
        })}
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--glass-border)' }}>
        <button
          className="nav-item"
          onClick={handleInstall}
          style={{
            background: isInstallable ? 'rgba(167, 139, 250, 0.12)' : 'transparent',
            border: isInstallable ? '1px solid rgba(167, 139, 250, 0.3)' : 'none',
            marginBottom: 4,
          }}
        >
          <Download size={20} color={isInstallable ? '#a78bfa' : 'var(--text-muted)'} />
          <span style={{ fontSize: '0.9rem' }}>{isInstallable ? 'Install App' : 'Get the App'}</span>
          {isInstallable && (
            <span style={{
              marginLeft: 'auto', fontSize: '0.6rem', padding: '2px 6px',
              borderRadius: 999, background: 'rgba(167, 139, 250, 0.2)', color: '#a78bfa', fontWeight: 700,
            }}>
              NEW
            </span>
          )}
        </button>
        <button className="nav-item" onClick={signOut}>
          <LogOut size={20} />
          <span style={{ fontSize: '0.9rem' }}>Sign Out</span>
        </button>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '8px 16px' }}>
          KSU Connect © 2026
        </p>
      </div>
    </aside>
  );
}
