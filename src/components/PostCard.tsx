import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Heart, MessageCircle, Share2, MoreHorizontal, Bookmark, BadgeCheck, Send, ChevronDown, ChevronUp, Trash2, X } from 'lucide-react';

interface Post {
  id: string; user_id: string; caption: string | null;
  media_urls: string[]; post_type: string;
  likes_count: number; comments_count: number; created_at: string;
  visibility: string; location_tag: string | null;
  profiles: { username: string; full_name: string | null; avatar_url: string | null; is_verified: boolean; };
}

interface Comment {
  id: string; body: string; user_id: string; created_at: string; likes_count: number;
  profiles: { username: string; avatar_url: string | null; };
}

interface PostCardProps {
  post: Post;
  onDelete?: (id: string) => void;
  setActivePage: (p: string) => void;
}

// Share option definition
interface ShareOption {
  icon: string;
  label: string;
  action: () => void;
  bg: string;
}

export default function PostCard({ post, onDelete, setActivePage }: PostCardProps) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [likeAnim, setLikeAnim] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentsCount, setCommentsCount] = useState(post.comments_count);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isOwner = user?.id === post.user_id;

  // Check if this post is liked
  useEffect(() => {
    if (!user) return;
    supabase.from('likes')
      .select('id').eq('user_id', user.id).eq('target_type', 'post').eq('target_id', post.id)
      .single().then(({ data }) => { if (data) setLiked(true); });
  }, [user, post.id]);

  // Check if this post is saved
  useEffect(() => {
    if (!user) return;
    supabase.from('saved_posts')
      .select('id').eq('user_id', user.id).eq('post_id', post.id)
      .maybeSingle().then(({ data }) => {
        if (data) { setIsSaved(true); setSavedId(data.id); }
      });
  }, [user, post.id]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLike = async () => {
    if (!user) return;
    if (profile?.is_suspended) { showToast('Your account is suspended.', 'error'); return; }
    setLikeAnim(true); setTimeout(() => setLikeAnim(false), 300);

    if (liked) {
      await supabase.from('likes').delete().eq('user_id', user.id).eq('target_type', 'post').eq('target_id', post.id);
      setLiked(false); setLikesCount(c => Math.max(0, c - 1));
    } else {
      await supabase.from('likes').insert({ user_id: user.id, target_type: 'post', target_id: post.id });
      setLiked(true); setLikesCount(c => c + 1);
      if (user.id !== post.user_id) {
        await supabase.from('notifications').insert({
          user_id: post.user_id, sender_id: user.id, type: 'like', target_id: post.id, is_read: false
        });
      }
    }
  };

  const loadComments = async () => {
    setLoadingComments(true);
    const { data } = await supabase.from('comments')
      .select('id,body,user_id,created_at,likes_count,profiles(username,avatar_url)')
      .eq('post_id', post.id).is('parent_id', null)
      .order('created_at', { ascending: true }).limit(20);
    if (data) setComments(data as any);
    setLoadingComments(false);
  };

  const toggleComments = () => {
    if (!showComments) loadComments();
    setShowComments(!showComments);
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !commentText.trim()) return;
    const { data: inserted } = await supabase.from('comments')
      .insert({ post_id: post.id, user_id: user.id, body: commentText.trim(), likes_count: 0 })
      .select('id,body,user_id,created_at,likes_count,profiles(username,avatar_url)').single();
    if (inserted) {
      setComments(prev => [...prev, inserted as any]);
      setCommentsCount(c => c + 1);
      if (user.id !== post.user_id) {
        await supabase.from('notifications').insert({
          user_id: post.user_id, sender_id: user.id, type: 'comment', target_id: post.id, is_read: false
        });
      }
      setCommentText('');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this post?')) return;
    await supabase.from('posts').delete().eq('id', post.id);
    showToast('Post deleted');
    onDelete?.(post.id);
  };

  const handleSavePost = async () => {
    if (!user) { showToast('Sign in to save posts', 'error'); return; }
    setShowMenu(false);
    if (isSaved && savedId) {
      await supabase.from('saved_posts').delete().eq('id', savedId);
      setIsSaved(false);
      setSavedId(null);
      showToast('Removed from saved');
    } else {
      const { data } = await supabase.from('saved_posts')
        .insert({ user_id: user.id, post_id: post.id })
        .select('id').single();
      if (data) { setIsSaved(true); setSavedId(data.id); }
      showToast('Post saved! 🔖 View in your profile');
    }
  };

  const handleShare = () => {
    setShowMenu(false);
    setShowSharePanel(true);
  };

  const postUrl = `${window.location.origin}?post=${post.id}`;

  const shareOptions: ShareOption[] = [
    {
      icon: '📋', label: 'Copy Link', bg: '#6366f1',
      action: () => {
        navigator.clipboard.writeText(postUrl);
        showToast('Link copied! 🔗');
        setShowSharePanel(false);
      },
    },
    {
      icon: '💬', label: 'WhatsApp', bg: '#25D366',
      action: () => {
        window.open(`https://wa.me/?text=${encodeURIComponent(`Check this out on KSU Connect!\n${postUrl}`)}`);
        setShowSharePanel(false);
      },
    },
    {
      icon: '🐦', label: 'Twitter / X', bg: '#1DA1F2',
      action: () => {
        window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(post.caption?.slice(0, 100) || 'Check this out!')}`);
        setShowSharePanel(false);
      },
    },
    {
      icon: '📘', label: 'Facebook', bg: '#1877F2',
      action: () => {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`);
        setShowSharePanel(false);
      },
    },
  ];

  const timeAgo = (date: string) => {
    const d = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (d < 60) return `${d}s ago`;
    if (d < 3600) return `${Math.floor(d / 60)}m ago`;
    if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
    return `${Math.floor(d / 86400)}d ago`;
  };

  const p = post.profiles;
  const initials = p?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || p?.username?.[0]?.toUpperCase() || '?';

  return (
    <>
      <div className="post-card">
        {/* Header */}
        <div className="post-header">
          <div style={{ cursor: 'pointer' }} onClick={() => setActivePage(`profile:${post.user_id}`)}>
            <div className="avatar-ring" style={{ padding: 2 }}>
              {p?.avatar_url
                ? <img src={p.avatar_url} className="avatar avatar-md" alt={p.username} />
                : <div className="avatar-placeholder avatar-md" style={{ fontSize: '0.9rem', border: '2px solid var(--bg-primary)' }}>{initials}</div>}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setActivePage(`profile:${post.user_id}`)}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 4 }}>
              {p?.username}
              {p?.is_verified && <BadgeCheck size={14} color="var(--neon-blue)" />}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {timeAgo(post.created_at)}{post.location_tag ? ` · 📍 ${post.location_tag}` : ''}
            </div>
          </div>

          {/* ⋯ More menu — background uses CSS var so it adapts to light & dark mode */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button className="btn btn-icon" style={{ width: 32, height: 32 }} onClick={() => setShowMenu(!showMenu)}>
              <MoreHorizontal size={16} />
            </button>
            {showMenu && (
              <div style={{
                position: 'absolute', right: 0, top: '110%',
                background: 'var(--bg-secondary)',           /* adapts light/dark */
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--border-radius-md)',
                overflow: 'hidden', zIndex: 50, minWidth: 170,
                boxShadow: 'var(--shadow-card)',
              }}>
                {/* Share */}
                <button
                  onClick={handleShare}
                  style={menuBtnStyle}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--glass-bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Share2 size={14} /> Share
                </button>
                {/* Save / Unsave */}
                <button
                  onClick={handleSavePost}
                  style={{ ...menuBtnStyle, color: isSaved ? 'var(--coral)' : 'var(--text-primary)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--glass-bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Bookmark size={14} fill={isSaved ? 'var(--coral)' : 'none'} />
                  {isSaved ? 'Unsave Post' : 'Save Post'}
                </button>
                {isOwner && <>
                  <div style={{ height: 1, background: 'var(--glass-border)' }} />
                  <button
                    onClick={handleDelete}
                    style={{ ...menuBtnStyle, color: 'var(--coral)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </>}
              </div>
            )}
          </div>
        </div>

        {/* Caption */}
        {post.caption && (
          <p className="post-caption" style={{ lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            {post.caption.split(/(\#\w+)/g).map((part, i) =>
              part.startsWith('#')
                ? <span key={i} className="hashtag">{part}</span>
                : part
            )}
          </p>
        )}

        {/* Media */}
        {post.media_urls?.length > 0 && (
          <div style={{ overflow: 'hidden' }}>
            {post.post_type === 'video'
              ? (
                <video
                  src={post.media_urls[0]}
                  controls
                  playsInline
                  preload="metadata"
                  className="post-media"
                  style={{ maxHeight: 400, width: '100%', background: '#000' }}
                  onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none'; }}
                />
              )
              : <img src={post.media_urls[0]} alt="post" className="post-media"
                style={{ maxHeight: 500 }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
          </div>
        )}

        {/* Actions */}
        <div className="post-actions">
          <button className={`action-btn ${liked ? 'liked' : ''}`} onClick={handleLike}>
            <Heart size={18} className={likeAnim ? 'like-pop' : ''} fill={liked ? 'var(--coral)' : 'none'} />
            <span>{likesCount}</span>
          </button>
          <button className="action-btn" onClick={toggleComments}>
            <MessageCircle size={18} />
            <span>{commentsCount}</span>
            {showComments ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {/* Share — opens share panel */}
          <button className="action-btn" style={{ marginLeft: 'auto' }} onClick={() => setShowSharePanel(true)}>
            <Share2 size={18} />
          </button>
          {/* Bookmark — toggles saved */}
          <button
            className="action-btn"
            onClick={handleSavePost}
            style={{ color: isSaved ? 'var(--coral)' : undefined }}
            title={isSaved ? 'Unsave post' : 'Save post'}
          >
            <Bookmark size={18} fill={isSaved ? 'var(--coral)' : 'none'} />
          </button>
        </div>

        {/* Comments section */}
        {showComments && (
          <div style={{ borderTop: '1px solid var(--glass-border)' }}>
            {loadingComments ? (
              <div className="loading-center" style={{ minHeight: 60 }}>
                <div className="spinner" style={{ width: 20, height: 20 }} />
              </div>
            ) : (
              <>
                {comments.map(c => {
                  const ci = c.profiles?.username?.[0]?.toUpperCase() || '?';
                  return (
                    <div key={c.id} className="comment-item">
                      {c.profiles?.avatar_url
                        ? <img src={c.profiles.avatar_url} className="avatar avatar-sm" alt={c.profiles.username} />
                        : <div className="avatar-placeholder avatar-sm" style={{ fontSize: '0.75rem' }}>{ci}</div>}
                      <div className="comment-body">
                        <div className="author">{c.profiles?.username}</div>
                        <p>{c.body}</p>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>{timeAgo(c.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
                {comments.length === 0 && <p style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No comments yet. Be first!</p>}
              </>
            )}
            {/* Add comment */}
            <form onSubmit={submitComment} style={{ display: 'flex', gap: 10, padding: '12px 16px', alignItems: 'center' }}>
              <div className="avatar-ring" style={{ padding: 2, flexShrink: 0 }}>
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} className="avatar avatar-sm" alt="you" />
                  : <div className="avatar-placeholder avatar-sm" style={{ fontSize: '0.7rem', border: '2px solid var(--bg-primary)' }}>
                    {profile?.username?.[0]?.toUpperCase()}
                  </div>}
              </div>
              <input value={commentText} onChange={e => setCommentText(e.target.value)}
                placeholder="Add a comment..." className="input"
                style={{ borderRadius: 'var(--border-radius-full)', padding: '8px 16px', fontSize: '0.85rem' }} />
              <button type="submit" className="btn btn-primary btn-icon" style={{ flexShrink: 0 }} disabled={!commentText.trim()}>
                <Send size={16} />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ═══ SHARE PANEL — Instagram-style bottom sheet ═══ */}
      {showSharePanel && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 1000,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowSharePanel(false)}
        >
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--glass-border)',
              borderRadius: '24px 24px 0 0',
              width: '100%', maxWidth: 600,
              paddingBottom: 'env(safe-area-inset-bottom, 16px)',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.3)',
              animation: 'slideUpPanel 0.25s cubic-bezier(0.25,0.46,0.45,0.94)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div style={{
              width: 40, height: 4, borderRadius: 99,
              background: 'var(--glass-border)',
              margin: '12px auto 0',
            }} />

            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px 14px',
              borderBottom: '1px solid var(--glass-border)',
            }}>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Share Post</span>
              <button
                onClick={() => setShowSharePanel(false)}
                style={{
                  background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                  borderRadius: '50%', width: 30, height: 30,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--text-muted)',
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Share grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
              padding: '20px 16px',
            }}>
              {shareOptions.map(opt => (
                <button
                  key={opt.label}
                  onClick={opt.action}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 16, padding: '14px 8px',
                    cursor: 'pointer', color: 'var(--text-primary)',
                    fontSize: '0.72rem', fontWeight: 600,
                    fontFamily: 'Inter, sans-serif',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.borderColor = opt.bg;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.borderColor = 'var(--glass-border)';
                  }}
                >
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: opt.bg + '22',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.5rem',
                  }}>
                    {opt.icon}
                  </div>
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Save to device — only if post has media */}
            {post.media_urls?.length > 0 && (
              <div style={{ padding: '0 16px 16px' }}>
                <button
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = post.media_urls[0];
                    a.download = `ksuconnect-post.${post.post_type === 'video' ? 'mp4' : 'jpg'}`;
                    a.target = '_blank';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    showToast('Saving to your device… ⬇️');
                    setShowSharePanel(false);
                  }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 14, padding: '14px 18px',
                    cursor: 'pointer', color: 'var(--text-primary)',
                    fontSize: '0.875rem', fontWeight: 600,
                    fontFamily: 'Inter, sans-serif',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--bg-card-hover)';
                    e.currentTarget.style.borderColor = 'var(--glass-border-hover)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'var(--glass-bg)';
                    e.currentTarget.style.borderColor = 'var(--glass-border)';
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: 'rgba(99,102,241,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.2rem', flexShrink: 0,
                  }}>⬇️</div>
                  <div style={{ textAlign: 'left' }}>
                    <div>Save to Device</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: 2 }}>
                      Download this {post.post_type === 'video' ? 'video' : 'photo'} to your phone
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Shared menu button style
const menuBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  width: '100%', padding: '10px 16px',
  background: 'transparent', border: 'none',
  color: 'var(--text-primary)', cursor: 'pointer',
  fontSize: '0.85rem', fontFamily: 'Inter, sans-serif',
  transition: 'background 0.15s ease',
};
