import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Search, Bell, MessageCircle, LogOut, Menu, X, Sparkles } from 'lucide-react';

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
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

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

  return (
    <header className="app-header">
      {/* Mobile menu toggle */}
      <button className="btn btn-icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        style={{ display: 'none' }} id="mobile-menu-btn">
        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
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
  );
}
