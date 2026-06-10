import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Heart, MessageCircle, Share2, MoreHorizontal, Bookmark, BadgeCheck, Send, ChevronDown, ChevronUp, Trash2, Edit } from 'lucide-react';

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
  const menuRef = useRef<HTMLDivElement>(null);
  const isOwner = user?.id === post.user_id;

  useEffect(() => {
    if (!user) return;
    supabase.from('likes')
      .select('id').eq('user_id', user.id).eq('target_type', 'post').eq('target_id', post.id)
      .single().then(({ data }) => { if (data) setLiked(true); });
  }, [user, post.id]);

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
      await supabase.from('posts').update({ likes_count: Math.max(0, likesCount - 1) }).eq('id', post.id);
      setLiked(false); setLikesCount(c => Math.max(0, c - 1));
    } else {
      await supabase.from('likes').insert({ user_id: user.id, target_type: 'post', target_id: post.id });
      await supabase.from('posts').update({ likes_count: likesCount + 1 }).eq('id', post.id);
      setLiked(true); setLikesCount(c => c + 1);
      // Notify post owner
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
      await supabase.from('posts').update({ comments_count: commentsCount + 1 }).eq('id', post.id);
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
        {/* More menu */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button className="btn btn-icon" style={{ width: 32, height: 32 }} onClick={() => setShowMenu(!showMenu)}>
            <MoreHorizontal size={16} />
          </button>
          {showMenu && (
            <div style={{
              position: 'absolute', right: 0, top: '110%', background: '#1a1a2e',
              border: '1px solid var(--glass-border)', borderRadius: 'var(--border-radius-md)',
              overflow: 'hidden', zIndex: 50, minWidth: 160, boxShadow: 'var(--shadow-card)',
            }}>
              <button onClick={() => { navigator.clipboard.writeText(window.location.href); showToast('Link copied!'); setShowMenu(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 16px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'Inter,sans-serif' }}>
                <Share2 size={14} /> Share
              </button>
              <button style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 16px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'Inter,sans-serif' }}>
                <Bookmark size={14} /> Save Post
              </button>
              {isOwner && <>
                <div style={{ height: 1, background: 'var(--glass-border)' }} />
                <button onClick={handleDelete}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 16px', background: 'none', border: 'none', color: 'var(--coral)', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'Inter,sans-serif' }}>
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
            ? <video src={post.media_urls[0]} controls className="post-media" style={{ maxHeight: 400 }} />
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
        <button className="action-btn" style={{ marginLeft: 'auto' }}
          onClick={() => { navigator.clipboard.writeText(window.location.href); showToast('Link copied!'); }}>
          <Share2 size={18} />
        </button>
        <button className="action-btn"><Bookmark size={18} /></button>
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
  );
}
