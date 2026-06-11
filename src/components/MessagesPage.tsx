import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Send, Search, MessageCircle } from 'lucide-react';

interface Conversation {
  id: string; username: string; full_name: string | null;
  avatar_url: string | null; last_message: string; unread: number;
}

interface Message {
  id: string; body: string; sender_id: string; created_at: string; is_read: boolean;
}

export default function MessagesPage({ initialUserId, setActivePage }: { initialUserId?: string; setActivePage: (p: string) => void }) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [typingIndicator, setTypingIndicator] = useState(false);

  useEffect(() => { if (user) fetchConversations(); }, [user]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const fetchConversations = async () => {
    if (!user) return;
    setLoading(true);
    // Get distinct conversation partners
    const { data: sent } = await supabase.from('messages').select('receiver_id').eq('sender_id', user.id);
    const { data: received } = await supabase.from('messages').select('sender_id').eq('receiver_id', user.id);
    const partnerIds = [...new Set([
      ...(sent?.map(m => m.receiver_id) || []),
      ...(received?.map(m => m.sender_id) || []),
    ])].filter(id => id !== user.id);

    if (!partnerIds.length) { setLoading(false); return; }

    const { data: profiles } = await supabase.from('profiles')
      .select('id,username,full_name,avatar_url').in('id', partnerIds);

    const convos: Conversation[] = await Promise.all((profiles || []).map(async p => {
      const { data: lastMsg } = await supabase.from('messages')
        .select('body').or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .or(`sender_id.eq.${p.id},receiver_id.eq.${p.id}`)
        .order('created_at', { ascending: false }).limit(1).single();
      const { count } = await supabase.from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', p.id).eq('receiver_id', user.id).eq('is_read', false);
      return { id: p.id, username: p.username, full_name: p.full_name, avatar_url: p.avatar_url, last_message: lastMsg?.body || '', unread: count || 0 };
    }));

    setConversations(convos);

    if (initialUserId) {
      const found = convos.find(c => c.id === initialUserId);
      if (found) openConversation(found);
    }
    setLoading(false);
  };

  const openConversation = async (conv: Conversation) => {
    setSelectedUser(conv);
    // Mark as read
    await supabase.from('messages').update({ is_read: true }).eq('sender_id', conv.id).eq('receiver_id', user!.id);
    // Fetch messages
    const { data } = await supabase.from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user!.id},receiver_id.eq.${conv.id}),and(sender_id.eq.${conv.id},receiver_id.eq.${user!.id})`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread: 0 } : c));
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedUser || !newMsg.trim()) return;
    const body = newMsg.trim();
    setNewMsg('');
    const { data, error } = await supabase.from('messages')
      .insert({ sender_id: user.id, receiver_id: selectedUser.id, body, is_read: false })
      .select().single();
    if (error) showToast('Failed to send message', 'error');
    else if (data) setMessages(prev => [...prev, data]);
    await supabase.from('notifications').insert({ user_id: selectedUser.id, sender_id: user.id, type: 'mention', target_id: null, is_read: false });
  };

  const timeAgo = (date: string) => {
    const d = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (d < 60) return `${d}s`;
    if (d < 3600) return `${Math.floor(d / 60)}m`;
    if (d < 86400) return `${Math.floor(d / 3600)}h`;
    return new Date(date).toLocaleDateString();
  };

  const filteredConvos = searchQ
    ? conversations.filter(c => c.username.toLowerCase().includes(searchQ.toLowerCase()) || c.full_name?.toLowerCase().includes(searchQ.toLowerCase()))
    : conversations;

  const myInitials = profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || profile?.username?.[0]?.toUpperCase() || '?';

  return (
    <div className="messages-layout" style={{ gap: 0, height: 'calc(100vh - var(--header-height) - 48px)', background: 'var(--glass-bg)', borderRadius: 'var(--border-radius-lg)', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
      {/* Sidebar */}
      <div className={`messages-sidebar${selectedUser ? '' : ' no-chat-selected'}`} style={{ borderRight: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <MessageCircle size={18} color="var(--coral)" />
            <span style={{ fontWeight: 700 }}>Messages</span>
          </div>
          <div className="input-group">
            <Search size={14} className="input-icon" />
            <input className="input" placeholder="Search conversations..." value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              style={{ padding: '8px 12px 8px 36px', fontSize: '0.82rem' }} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div className="loading-center" style={{ minHeight: 120 }}><div className="spinner" /></div>
          ) : filteredConvos.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <MessageCircle size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              <p>No conversations yet</p>
              <p style={{ marginTop: 4 }}>Find people to message via their profile</p>
            </div>
          ) : filteredConvos.map(c => (
            <div key={c.id} onClick={() => openConversation(c)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer',
                background: selectedUser?.id === c.id ? 'rgba(255,107,107,0.08)' : 'transparent',
                borderLeft: selectedUser?.id === c.id ? '3px solid var(--coral)' : '3px solid transparent',
                transition: 'background 0.15s',
              }}>
              {c.avatar_url
                ? <img src={c.avatar_url} className="avatar avatar-md" alt={c.username} />
                : <div className="avatar-placeholder avatar-md" style={{ fontSize: '0.9rem' }}>{c.username[0].toUpperCase()}</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{c.username}</span>
                  {c.unread > 0 && <span className="badge badge-coral" style={{ fontSize: '0.65rem' }}>{c.unread}</span>}
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.last_message || 'No messages yet'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      {selectedUser ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Chat header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn btn-secondary btn-sm chat-back-btn" style={{ display: 'none', marginRight: 8, padding: '6px 8px' }}
              onClick={() => setSelectedUser(null)}>
              ←
            </button>
            {selectedUser.avatar_url
              ? <img src={selectedUser.avatar_url} className="avatar avatar-sm" alt={selectedUser.username} />
              : <div className="avatar-placeholder avatar-sm" style={{ fontSize: '0.75rem' }}>{selectedUser.username[0].toUpperCase()}</div>}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{selectedUser.full_name || selectedUser.username}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{selectedUser.username}</div>
            </div>
            <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}
              onClick={() => setActivePage(`profile:${selectedUser.id}`)}>View Profile</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.map(m => {
              const isMine = m.sender_id === user?.id;
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
                  {!isMine && (
                    selectedUser.avatar_url
                      ? <img src={selectedUser.avatar_url} className="avatar avatar-xs" alt={selectedUser.username} />
                      : <div className="avatar-placeholder avatar-xs" style={{ fontSize: '0.6rem' }}>{selectedUser.username[0].toUpperCase()}</div>
                  )}
                  <div style={{ maxWidth: '70%' }}>
                    <div className={`chat-bubble ${isMine ? 'sent' : 'received'}`}>{m.body}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2, textAlign: isMine ? 'right' : 'left' }}>
                      {timeAgo(m.created_at)}
                    </div>
                  </div>
                  {isMine && (
                    profile?.avatar_url
                      ? <img src={profile.avatar_url} className="avatar avatar-xs" alt="you" />
                      : <div className="avatar-placeholder avatar-xs" style={{ fontSize: '0.6rem' }}>{myInitials}</div>
                  )}
                </div>
              );
            })}
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                <div>
                  <MessageCircle size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                  <p>Start a conversation with {selectedUser.username}!</p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} style={{ padding: '12px 20px', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: 10 }}>
            <input className="input" placeholder={`Message @${selectedUser.username}...`}
              value={newMsg} onChange={e => setNewMsg(e.target.value)}
              style={{ borderRadius: 'var(--border-radius-full)', flex: 1 }} />
            <button type="submit" className="btn btn-primary btn-icon" disabled={!newMsg.trim()}>
              <Send size={18} />
            </button>
          </form>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <div style={{ textAlign: 'center' }}>
            <MessageCircle size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
            <h3>Select a conversation</h3>
            <p style={{ marginTop: 8, fontSize: '0.875rem' }}>Choose from your existing conversations or visit someone's profile to start a new one</p>
          </div>
        </div>
      )}
    </div>
  );
}
