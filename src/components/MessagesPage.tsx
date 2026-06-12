import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Send, Search, MessageCircle, Users, ChevronLeft, Plus, Smile, X } from 'lucide-react';

// ─────────────────────────────────────────────
// CUSTOM EMOJI KEYBOARD DATA
// ─────────────────────────────────────────────
const EMOJI_CATEGORIES = [
  {
    label: '⭐ KSU',
    icon: '🎓',
    emojis: [
      '🎓','📚','✏️','🏫','📐','📏','🔬','🔭','📡','🏆',
      '🥇','🎯','💡','🧠','📝','🗒️','📖','🖊️','📌','🏅',
      '💪','🙌','👏','🤝','✨','🌟','⭐','💫','🔥','🚀',
    ],
  },
  {
    label: '😊 Faces',
    icon: '😊',
    emojis: [
      '😀','😁','😂','🤣','😊','😍','🥰','😎','🤩','🥳',
      '😜','🤪','😏','🤔','🤫','😐','😑','🙄','😒','😔',
      '😢','😭','😤','😠','🤯','😱','🤗','🥺','😴','🤤',
      '😋','🤭','😇','🥴','🤑','😈','👿','💀','🤡','👻',
    ],
  },
  {
    label: '❤️ Love',
    icon: '❤️',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💕',
      '💞','💓','💗','💖','💘','💝','💟','❣️','💔','🔥',
      '💯','✨','🌹','💐','🌷','🌸','🫶','🥰','😘','💋',
    ],
  },
  {
    label: '👋 Greet',
    icon: '👋',
    emojis: [
      '👋','🤚','🖐️','✋','🖖','🤙','👌','🤌','🤏','✌️',
      '🤞','🤟','🤘','👍','👎','👊','✊','🤛','🤜','🤝',
      '🙏','💪','🦾','👏','🙌','🤲','👐','🤜','🫂','🫶',
    ],
  },
  {
    label: '🎉 Fun',
    icon: '🎉',
    emojis: [
      '🎉','🎊','🎈','🎁','🎀','🎆','🎇','🧨','🎭','🎪',
      '🎮','🕹️','🎲','🎯','🎳','🏆','🥇','🏅','🎵','🎶',
      '🎸','🎤','🎧','💃','🕺','🥂','🍾','🎂','🍰','🧁',
    ],
  },
  {
    label: '😂 Memes',
    icon: '💬',
    emojis: [
      '💀','☠️','🫡','🫠','🥲','🤌','💅','👀','🗿','😤',
      '😵','🤡','🐐','📌','💯','🫶','🫵','🔔','📢','‼️',
      '❓','❗','🚨','⚠️','🆘','💬','🗨️','🔊','📣','🎙️',
    ],
  },
];

// ─────────────────────────────────────────────
// EMOJI PICKER PANEL
// ─────────────────────────────────────────────
function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div style={{
      background: 'linear-gradient(180deg, #0f0f1a 0%, #0a0a0f 100%)',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      display: 'flex', flexDirection: 'column',
      userSelect: 'none',
    }}>
      {/* Category tabs */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button key={i} onClick={() => setActiveTab(i)} style={{
            flex: '0 0 auto', padding: '10px 14px',
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontSize: '1.15rem', position: 'relative',
            opacity: activeTab === i ? 1 : 0.5,
            transition: 'opacity 0.15s',
          }}>
            {cat.icon}
            {activeTab === i && (
              <div style={{
                position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
                width: 20, height: 2, borderRadius: 99,
                background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)',
              }} />
            )}
          </button>
        ))}
        <button onClick={onClose} style={{
          marginLeft: 'auto', padding: '10px 12px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.4)', flexShrink: 0,
        }}>
          <X size={16} />
        </button>
      </div>

      {/* Category label */}
      <div style={{
        padding: '6px 14px 2px',
        fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em',
        color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase',
      }}>
        {EMOJI_CATEGORIES[activeTab].label}
      </div>

      {/* Emoji grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(8,1fr)',
        gap: 2, padding: '4px 8px 12px', overflowY: 'auto', maxHeight: 180,
      }}>
        {EMOJI_CATEGORIES[activeTab].emojis.map((em, i) => (
          <button key={i} onClick={() => onSelect(em)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontSize: '1.45rem', padding: '6px 0',
            borderRadius: 10, lineHeight: 1,
            transition: 'background 0.1s, transform 0.1s',
          }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.2)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
            }}
          >
            {em}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface Conversation {
  id: string; username: string; full_name: string | null;
  avatar_url: string | null; last_message: string; unread: number;
}

interface Message {
  id: string; body: string; sender_id: string; created_at: string; is_read: boolean;
}

interface FriendProfile {
  id: string; username: string; full_name: string | null; avatar_url: string | null;
}

type SidebarTab = 'chats' | 'friends';

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
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
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chats');
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showEmoji, setShowEmoji] = useState(false);

  // ── Keyboard viewport fix: shrink the whole container to the visual viewport ──
  const layoutRef = useRef<HTMLDivElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const inputBarRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (!vv) return;

    const HEADER_H = 64;   // --header-height
    const MAIN_PAD = 24;   // app-main padding-top

    const onResize = () => {
      const el = layoutRef.current;
      if (!el) return;
      // vv.height = visible area above keyboard
      const newH = Math.floor(vv.height) - HEADER_H - MAIN_PAD;
      el.style.height = `${Math.max(200, newH)}px`;
      // Scroll messages into view after resize settles
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'instant' }), 60);
    };

    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => { if (user) fetchConversations(); }, [user]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Real-time incoming messages
  useEffect(() => {
    if (!user || !selectedUser) return;
    const channel = supabase.channel(`chat-${user.id}-${selectedUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `receiver_id=eq.${user.id}`,
      }, (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id === selectedUser.id) {
          setMessages(prev => [...prev, msg]);
          supabase.from('messages').update({ is_read: true }).eq('id', msg.id).then();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, selectedUser]);

  const fetchConversations = async () => {
    if (!user) return;
    setLoading(true);
    const { data: sent } = await supabase.from('messages').select('receiver_id').eq('sender_id', user.id);
    const { data: received } = await supabase.from('messages').select('sender_id').eq('receiver_id', user.id);
    const partnerIds = [...new Set([
      ...(sent?.map(m => m.receiver_id) || []),
      ...(received?.map(m => m.sender_id) || []),
    ])].filter(id => id !== user.id);

    let convos: Conversation[] = [];
    if (partnerIds.length) {
      const { data: profiles } = await supabase.from('profiles')
        .select('id,username,full_name,avatar_url').in('id', partnerIds);
      convos = await Promise.all((profiles || []).map(async p => {
        const { data: lastMsg } = await supabase.from('messages')
          .select('body').or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .or(`sender_id.eq.${p.id},receiver_id.eq.${p.id}`)
          .order('created_at', { ascending: false }).limit(1).single();
        const { count } = await supabase.from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender_id', p.id).eq('receiver_id', user.id).eq('is_read', false);
        return { id: p.id, username: p.username, full_name: p.full_name, avatar_url: p.avatar_url, last_message: lastMsg?.body || '', unread: count || 0 };
      }));
    }
    setConversations(convos);

    if (initialUserId) {
      const found = convos.find(c => c.id === initialUserId);
      if (found) { openConversation(found); }
      else {
        const { data: p } = await supabase.from('profiles').select('id,username,full_name,avatar_url').eq('id', initialUserId).single();
        if (p) { setSelectedUser({ id: p.id, username: p.username, full_name: p.full_name, avatar_url: p.avatar_url, last_message: '', unread: 0 }); setMessages([]); }
      }
    }
    setLoading(false);
  };

  const fetchFriends = async () => {
    if (!user || friendsLoading) return;
    setFriendsLoading(true);
    const { data } = await supabase.from('follows')
      .select('following_id, profiles!follows_following_id_fkey(id,username,full_name,avatar_url)')
      .eq('follower_id', user.id);
    if (data) setFriends(data.map((d: any) => d.profiles).filter(Boolean));
    setFriendsLoading(false);
  };

  const handleSidebarTab = (tab: SidebarTab) => {
    setSidebarTab(tab);
    if (tab === 'friends' && friends.length === 0) fetchFriends();
  };

  const openConversation = async (conv: Conversation) => {
    setSelectedUser(conv);
    setShowEmoji(false);
    await supabase.from('messages').update({ is_read: true }).eq('sender_id', conv.id).eq('receiver_id', user!.id);
    const { data } = await supabase.from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user!.id},receiver_id.eq.${conv.id}),and(sender_id.eq.${conv.id},receiver_id.eq.${user!.id})`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread: 0 } : c));
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const openFriendChat = (friend: FriendProfile) => {
    const existing = conversations.find(c => c.id === friend.id);
    if (existing) { openConversation(existing); }
    else {
      setSelectedUser({ id: friend.id, username: friend.username, full_name: friend.full_name, avatar_url: friend.avatar_url, last_message: '', unread: 0 });
      setMessages([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    setSidebarTab('chats');
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedUser || !newMsg.trim()) return;
    const body = newMsg.trim();
    setNewMsg('');
    setShowEmoji(false);
    const { data, error } = await supabase.from('messages')
      .insert({ sender_id: user.id, receiver_id: selectedUser.id, body, is_read: false })
      .select().single();
    if (error) showToast('Failed to send message', 'error');
    else if (data) {
      setMessages(prev => [...prev, data]);
      if (!conversations.find(c => c.id === selectedUser.id))
        setConversations(prev => [{ ...selectedUser, last_message: body }, ...prev]);
      else
        setConversations(prev => prev.map(c => c.id === selectedUser.id ? { ...c, last_message: body } : c));
    }
    await supabase.from('notifications').insert({ user_id: selectedUser.id, sender_id: user.id, type: 'mention', target_id: null, is_read: false });
  };

  const insertEmoji = (em: string) => {
    setNewMsg(prev => prev + em);
    inputRef.current?.focus();
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

  const filteredFriends = searchQ
    ? friends.filter(f => f.username.toLowerCase().includes(searchQ.toLowerCase()) || f.full_name?.toLowerCase().includes(searchQ.toLowerCase()))
    : friends;

  const myInitials = profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || profile?.username?.[0]?.toUpperCase() || '?';

  return (
    <div ref={layoutRef} className="messages-layout" style={{
      gap: 0,
      height: 'calc(100vh - var(--header-height) - 48px)',
      background: 'var(--glass-bg)',
      borderRadius: 'var(--border-radius-lg)',
      overflow: 'hidden',
      border: '1px solid var(--glass-border)',
      transition: 'height 0.05s linear',
    }}>
      {/* ── Sidebar ── */}
      <div className={`messages-sidebar${selectedUser ? '' : ' no-chat-selected'}`}
        style={{ borderRight: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <MessageCircle size={18} color="var(--coral)" />
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>Messages</span>
          </div>
          <div className="input-group">
            <Search size={14} className="input-icon" />
            <input className="input" placeholder="Search…" value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              style={{ padding: '8px 12px 8px 36px', fontSize: '0.82rem' }} />
          </div>
          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
            {(['chats', 'friends'] as SidebarTab[]).map(tab => (
              <button key={tab} onClick={() => handleSidebarTab(tab)} style={{
                flex: 1, padding: '6px 0', fontSize: '0.78rem', fontWeight: 600,
                borderRadius: 'var(--border-radius-md)', border: 'none', cursor: 'pointer',
                transition: 'all 0.15s',
                background: sidebarTab === tab ? 'var(--coral)' : 'rgba(255,255,255,0.07)',
                color: sidebarTab === tab ? 'white' : 'var(--text-secondary)',
              }}>
                {tab === 'chats' ? <><MessageCircle size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />Chats</> : <><Users size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />Friends</>}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sidebarTab === 'chats' ? (
            loading ? (
              <div className="loading-center" style={{ minHeight: 120 }}><div className="spinner" /></div>
            ) : filteredConvos.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <MessageCircle size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                <p>No conversations yet</p>
                <p style={{ marginTop: 4 }}>Go to <strong>Friends</strong> tab to start chatting</p>
              </div>
            ) : filteredConvos.map(c => (
              <div key={c.id} onClick={() => openConversation(c)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer',
                background: selectedUser?.id === c.id ? 'rgba(59,130,246,0.1)' : 'transparent',
                borderLeft: selectedUser?.id === c.id ? '3px solid var(--coral)' : '3px solid transparent',
                transition: 'background 0.15s',
              }}>
                {c.avatar_url ? <img src={c.avatar_url} className="avatar avatar-md" alt={c.username} />
                  : <div className="avatar-placeholder avatar-md" style={{ fontSize: '0.9rem' }}>{c.username[0].toUpperCase()}</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{c.full_name || c.username}</span>
                    {c.unread > 0 && <span className="badge badge-coral" style={{ fontSize: '0.65rem' }}>{c.unread}</span>}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.last_message || 'No messages yet'}
                  </p>
                </div>
              </div>
            ))
          ) : (
            friendsLoading ? (
              <div className="loading-center" style={{ minHeight: 120 }}><div className="spinner" /></div>
            ) : filteredFriends.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <Users size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                <p>No friends yet</p>
                <p style={{ marginTop: 4 }}>Follow people to see them here</p>
              </div>
            ) : filteredFriends.map(f => (
              <div key={f.id} onClick={() => openFriendChat(f)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', transition: 'background 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {f.avatar_url ? <img src={f.avatar_url} className="avatar avatar-md" alt={f.username} />
                  : <div className="avatar-placeholder avatar-md" style={{ fontSize: '0.9rem' }}>{f.username[0].toUpperCase()}</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{f.full_name || f.username}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{f.username}</div>
                </div>
                <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(59,130,246,0.15)', color: 'var(--coral)', flexShrink: 0 }}>
                  <Plus size={14} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Chat area ── */}
      {selectedUser ? (
        <div ref={chatAreaRef} style={{ display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
          {/* Chat header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
            <button className="btn btn-secondary btn-sm chat-back-btn" style={{ display: 'none', marginRight: 4, padding: '6px 10px' }}
              onClick={() => { setSelectedUser(null); setShowEmoji(false); }}>
              <ChevronLeft size={16} />
            </button>
            {selectedUser.avatar_url
              ? <img src={selectedUser.avatar_url} className="avatar avatar-sm" alt={selectedUser.username} />
              : <div className="avatar-placeholder avatar-sm" style={{ fontSize: '0.75rem' }}>{selectedUser.username[0].toUpperCase()}</div>}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{selectedUser.full_name || selectedUser.username}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{selectedUser.username}</div>
            </div>
            <button className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              onClick={() => setActivePage(`profile:${selectedUser.id}`)}>View Profile</button>
          </div>

          {/* Messages scroll area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexDirection: 'column', gap: 12, paddingTop: 60 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}>
                  <MessageCircle size={28} color="white" />
                </div>
                <div>
                  <p style={{ fontWeight: 600, marginBottom: 4 }}>Start a conversation</p>
                  <p style={{ fontSize: '0.82rem' }}>Say hi to {selectedUser.full_name || selectedUser.username}! 👋</p>
                </div>
              </div>
            )}
            {messages.map(m => {
              const isMine = m.sender_id === user?.id;
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
                  {!isMine && (selectedUser.avatar_url
                    ? <img src={selectedUser.avatar_url} className="avatar avatar-xs" alt={selectedUser.username} />
                    : <div className="avatar-placeholder avatar-xs" style={{ fontSize: '0.6rem' }}>{selectedUser.username[0].toUpperCase()}</div>)}
                  <div style={{ maxWidth: '70%' }}>
                    <div className={`chat-bubble ${isMine ? 'sent' : 'received'}`}>{m.body}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2, textAlign: isMine ? 'right' : 'left' }}>
                      {timeAgo(m.created_at)}
                    </div>
                  </div>
                  {isMine && (profile?.avatar_url
                    ? <img src={profile.avatar_url} className="avatar avatar-xs" alt="you" />
                    : <div className="avatar-placeholder avatar-xs" style={{ fontSize: '0.6rem' }}>{myInitials}</div>)}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Custom emoji picker panel ── */}
          {showEmoji && (
            <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmoji(false)} />
          )}

          {/* ── Input bar ── */}
          <form ref={inputBarRef} onSubmit={sendMessage} style={{
            padding: '10px 12px',
            borderTop: '1px solid var(--glass-border)',
            background: 'rgba(10,10,15,0.97)',
            backdropFilter: 'blur(20px)',
            display: 'flex', gap: 8, alignItems: 'center',
            flexShrink: 0,
            paddingBottom: 'env(safe-area-inset-bottom, 10px)',
          }}>
            {/* Emoji toggle button */}
            <button type="button" onClick={() => { setShowEmoji(v => !v); }}
              style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0, border: 'none',
                background: showEmoji ? 'var(--coral)' : 'rgba(255,255,255,0.08)',
                color: showEmoji ? 'white' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.15s', fontSize: '1.1rem',
              }}>
              <Smile size={18} />
            </button>

            {/* Text input */}
            <input
              ref={inputRef}
              className="input"
              placeholder={`Message ${selectedUser.full_name || '@' + selectedUser.username}…`}
              value={newMsg}
              onChange={e => setNewMsg(e.target.value)}
              onFocus={() => setShowEmoji(false)}
              style={{ borderRadius: 'var(--border-radius-full)', flex: 1, minWidth: 0 }}
            />

            {/* Send button */}
            <button type="submit" disabled={!newMsg.trim()} style={{
              width: 42, height: 42, borderRadius: '50%', flexShrink: 0, border: 'none',
              background: newMsg.trim()
                ? 'linear-gradient(135deg,var(--coral),var(--neon-purple))'
                : 'rgba(255,255,255,0.08)',
              color: newMsg.trim() ? 'white' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: newMsg.trim() ? 'pointer' : 'default',
              transition: 'all 0.2s',
              boxShadow: newMsg.trim() ? '0 4px 20px rgba(59,130,246,0.4)' : 'none',
            }}>
              <Send size={17} />
            </button>
          </form>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', opacity: 0.25 }}>
              <MessageCircle size={36} color="white" />
            </div>
            <h3 style={{ marginBottom: 8 }}>Your Messages</h3>
            <p style={{ fontSize: '0.875rem', maxWidth: 240, margin: '0 auto' }}>
              Pick a conversation from the left, or open the <strong>Friends</strong> tab to start a new one
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
