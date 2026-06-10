import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Bell, Check, Trash2, Heart, MessageCircle, UserPlus, AtSign } from 'lucide-react';

interface Notif {
  id: string; type: string; is_read: boolean; created_at: string; target_id: string | null;
  sender: { username: string; avatar_url: string | null; full_name: string | null; };
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: (u: string) => string; color: string }> = {
  like: { icon: <Heart size={14} fill="var(--coral)" color="var(--coral)" />, label: u => `${u} liked your post`, color: 'var(--coral)' },
  comment: { icon: <MessageCircle size={14} color="var(--neon-blue)" />, label: u => `${u} commented on your post`, color: 'var(--neon-blue)' },
  follow: { icon: <UserPlus size={14} color="var(--neon-purple)" />, label: u => `${u} started following you`, color: 'var(--neon-purple)' },
  follow_request: { icon: <UserPlus size={14} color="var(--gold)" />, label: u => `${u} requested to follow you`, color: 'var(--gold)' },
  mention: { icon: <AtSign size={14} color="var(--neon-blue)" />, label: u => `${u} mentioned you in a post`, color: 'var(--neon-blue)' },
};

export default function NotificationsPage({ setActivePage }: { setActivePage: (p: string) => void }) {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) fetchNotifs(); }, [user]);

  const fetchNotifs = async () => {
    setLoading(true);
    const { data } = await supabase.from('notifications')
      .select('id,type,is_read,created_at,target_id,sender:sender_id(username,avatar_url,full_name)')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setNotifs(data as any);
    setLoading(false);
  };

  const markAllRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user!.id).eq('is_read', false);
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const deleteNotif = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifs(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = async () => {
    await supabase.from('notifications').delete().eq('user_id', user!.id);
    setNotifs([]);
  };

  const timeAgo = (date: string) => {
    const d = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (d < 60) return `${d}s ago`;
    if (d < 3600) return `${Math.floor(d / 60)}m ago`;
    if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
    return `${Math.floor(d / 86400)}d ago`;
  };

  const unread = notifs.filter(n => !n.is_read).length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Bell size={22} color="var(--coral)" />
          <h2 style={{ fontSize: '1.3rem' }}>Notifications</h2>
          {unread > 0 && <span className="badge badge-coral">{unread}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {unread > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={markAllRead}>
              <Check size={14} /> Mark all read
            </button>
          )}
          {notifs.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={clearAll} style={{ color: 'var(--coral)' }}>
              <Trash2 size={14} /> Clear all
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : notifs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔔</div>
          <h3>All caught up!</h3>
          <p style={{ marginTop: 8 }}>No notifications yet</p>
        </div>
      ) : (
        <div className="glass-card-sm" style={{ overflow: 'hidden', padding: 0 }}>
          {notifs.map((n, i) => {
            const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.like;
            const sender = n.sender as any;
            const initials = sender?.username?.[0]?.toUpperCase() || '?';
            return (
              <div key={n.id} className={`notif-item ${!n.is_read ? 'unread' : ''}`}
                style={{ borderBottom: i < notifs.length - 1 ? '1px solid var(--glass-border)' : 'none' }}
                onClick={async () => {
                  await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
                  setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
                  if (n.type === 'follow' && sender?.username) setActivePage(`profile:${n.target_id}`);
                  else if (n.target_id) setActivePage(`post:${n.target_id}`);
                }}>
                {!n.is_read && <span className="notif-dot" />}
                <div style={{ position: 'relative' }}>
                  {sender?.avatar_url
                    ? <img src={sender.avatar_url} className="avatar avatar-md" alt={sender.username} />
                    : <div className="avatar-placeholder avatar-md" style={{ fontSize: '0.9rem' }}>{initials}</div>}
                  <span style={{
                    position: 'absolute', bottom: -2, right: -2, background: '#1a1a2e',
                    borderRadius: '50%', width: 20, height: 20,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${config.color}`,
                  }}>{config.icon}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.875rem', lineHeight: 1.4 }}>
                    <strong>{sender?.username}</strong>{' '}
                    {config.label('').replace(sender?.username || '', '')}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{timeAgo(n.created_at)}</p>
                </div>
                <button onClick={e => { e.stopPropagation(); deleteNotif(n.id); }}
                  className="btn btn-icon" style={{ width: 28, height: 28, opacity: 0.5 }}>
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
