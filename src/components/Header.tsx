import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Search, Bell, MessageCircle, LogOut, Menu, X, Sparkles, Moon, Sun, Shield, Settings, Home, Compass, User, TrendingUp, Users, CreditCard, Crown, Download } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useSubscription } from '../context/SubscriptionContext';

interface HeaderProps {
  activePage: string;
  setActivePage: (p: string) => void;
  unreadNotifs: number;
  unreadMessages: number;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (v: boolean) => void;
}

interface SearchResult {
  id: string; username: string; full_name: string | null; avatar_url: string | null; is_verified: boolean;
}

export default function Header({ activePage, setActivePage, unreadNotifs, unreadMessages, mobileMenuOpen, setMobileMenuOpen }: HeaderProps) {
  const { profile, signOut } = useAuth();
  const { isActive } = useSubscription();
  const { settings, update } = useSettings();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
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
      alert('To install KSU Connect:\n\n📱 Android: Open in Chrome → Menu → "Install app" or "Add to Home screen"\n💻 Desktop: Open in Chrome → 🔒 (lock icon) → "Install KSU Connect"\n\nOr simply use the browser bookmark!');
    }
  };

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setShowDropdown(false); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('profiles')
        .select('id,username,full_name,avatar_url,is_verified')
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
        .limit(6);
      if (data) { setResults(data); setShowDropdown(true); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || profile?.username?.[0]?.toUpperCase() || '?';

  const navItems = [
    { id: 'feed', icon: Home, label: 'Home Feed' },
    { id: 'explore', icon: Compass, label: 'Explore' },
    { id: 'notifications', icon: Bell, label: 'Notifications', badge: unreadNotifs },
    { id: 'messages', icon: MessageCircle, label: 'Messages', badge: unreadMessages },
    { id: 'profile', icon: User, label: 'My Profile' },
    { id: 'trending', icon: TrendingUp, label: 'Trending' },
    { id: 'people', icon: Users, label: 'People' },
    { id: 'premium', icon: isActive ? Crown : CreditCard, label: isActive ? 'Premium' : 'Go Premium' },
    ...(profile?.is_admin ? [{ id: 'admin', icon: Shield, label: 'Admin Panel' }] : []),
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  const handleNavClick = (id: string) => {
    setActivePage(id);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="app-header">
        {/* Mobile hamburger */}
        <button className="btn btn-icon mobile-hamburger" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
          <Menu size={22} />
        </button>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexShrink: 0 }}
          onClick={() => setActivePage('feed')}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--gradient-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-glow-coral)',
          }}>
            <Sparkles size={18} color="white" />
          </div>
          <span style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: '1.15rem' }}
            className="gradient-text">KSU CONNECT</span>
        </div>

        {/* Search */}
        <div ref={searchRef} style={{ flex: 1, maxWidth: 420, position: 'relative' }}>
          <div className="input-group">
            <Search size={16} className="input-icon" />
            <input className="input" placeholder="Search people, posts, hashtags..."
              value={query} onChange={e => setQuery(e.target.value)}
              style={{ borderRadius: 'var(--border-radius-full)', padding: '9px 16px 9px 40px' }} />
          </div>
          {showDropdown && results.length > 0 && (
            <div className="search-dropdown">
              {results.map(r => (
                <div key={r.id} className="search-result" onClick={() => {
                  setActivePage(`profile:${r.id}`); setShowDropdown(false); setQuery('');
                }}>
                  {r.avatar_url
                    ? <img src={r.avatar_url} className="avatar avatar-sm" alt={r.username} />
                    : <div className="avatar-placeholder avatar-sm" style={{ fontSize: '0.8rem' }}>
                      {r.username[0].toUpperCase()}
                    </div>}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {r.username}
                      {r.is_verified && <span style={{ color: 'var(--neon-blue)', fontSize: '0.75rem' }}>✓</span>}
                    </div>
                    {r.full_name && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.full_name}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <button className="btn btn-icon" style={{ position: 'relative' }} onClick={() => setActivePage('messages')}>
            <MessageCircle size={20} />
            {unreadMessages > 0 && (
              <span style={{
                position: 'absolute', top: -2, right: -2, background: 'var(--coral)',
                color: 'white', fontSize: '0.6rem', fontWeight: 700,
                minWidth: 16, height: 16, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px'
              }}>{unreadMessages}</span>
            )}
          </button>
          <button className="btn btn-icon" style={{ position: 'relative' }} onClick={() => setActivePage('notifications')}>
            <Bell size={20} />
            {unreadNotifs > 0 && (
              <span style={{
                position: 'absolute', top: -2, right: -2, background: 'var(--coral)',
                color: 'white', fontSize: '0.6rem', fontWeight: 700,
                minWidth: 16, height: 16, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px'
              }}>{unreadNotifs}</span>
            )}
          </button>
          <button onClick={() => setActivePage('profile')} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0
          }}>
            <div className="avatar-ring" style={{ padding: 2 }}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} className="avatar avatar-sm" alt="you" />
                : <div className="avatar-placeholder avatar-sm" style={{ fontSize: '0.8rem', border: '2px solid var(--bg-primary)' }}>
                  {initials}
                </div>}
            </div>
          </button>
          <button className="btn btn-icon" onClick={signOut} title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Mobile Drawer */}
      <div className={`mobile-drawer ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--gradient-brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'var(--shadow-glow-coral)',
            }}>
              <Sparkles size={18} color="white" />
            </div>
            <span style={{ fontFamily: 'Outfit,sans-serif', fontWeight: 800, fontSize: '1.15rem' }}
              className="gradient-text">KSU CONNECT</span>
          </div>
          <button className="btn btn-icon" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">
            <X size={22} />
          </button>
        </div>

        {/* Profile card */}
        <div className="mobile-drawer-profile" onClick={() => handleNavClick('profile')}>
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
            <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(76, 201, 240, 0.15)', color: 'var(--neon-blue)', fontSize: '0.65rem', fontWeight: 700, marginLeft: 'auto' }}>
              PRO
            </span>
          )}
        </div>

        {/* Nav items */}
        <nav className="mobile-drawer-nav">
          {navItems.map(({ id, icon: Icon, label, badge }) => {
            const isNavActive = activePage === id || activePage.startsWith(`${id}:`);
            const isPremiumLink = id === 'premium';
            const isAdminLink = id === 'admin';
            return (
              <button
                key={id}
                className={`nav-item ${isNavActive ? 'active' : ''} ${isAdminLink ? 'admin-link' : ''}`}
                onClick={() => handleNavClick(id)}
                style={isPremiumLink ? {
                  background: 'var(--gradient-brand)',
                  color: 'white',
                  fontWeight: 700,
                  marginTop: 8,
                } : isAdminLink ? {
                  background: 'rgba(76, 201, 240, 0.08)',
                  border: '1px solid rgba(76, 201, 240, 0.2)',
                  marginTop: 4,
                } : undefined}
              >
                <Icon size={20} />
                <span style={{ fontSize: '0.9rem' }}>{label}</span>
                {badge && badge > 0 && <span className="nav-badge">{badge > 99 ? '99+' : badge}</span>}
              </button>
            );
          })}
        </nav>

        {/* Theme toggle */}
        <div className="mobile-drawer-theme">
          <button
            className="nav-item"
            onClick={() => update('theme', settings.theme === 'dark' ? 'light' : 'dark')}
          >
            {settings.theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            <span style={{ fontSize: '0.9rem' }}>{settings.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>

        {/* Install / Sign Out */}
        <div className="mobile-drawer-footer">
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
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '12px 16px', textAlign: 'center' }}>
            KSU Connect © 2026
          </p>
        </div>
      </div>
    </>
  );
}