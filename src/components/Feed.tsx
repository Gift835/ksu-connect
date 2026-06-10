import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSubscription } from '../context/SubscriptionContext';
import { Image, MapPin, Globe, Lock, Users, X, Smile, Crown, Ban, Sparkles } from 'lucide-react';
import PostCard from './PostCard';

interface Post {
  id: string; user_id: string; caption: string | null;
  media_urls: string[]; post_type: string;
  likes_count: number; comments_count: number; created_at: string;
  visibility: string; location_tag: string | null;
  profiles: { username: string; full_name: string | null; avatar_url: string | null; is_verified: boolean; };
}

const EMOJIS = ['😊', '🎉', '🔥', '💯', '👏', '❤️', '😂', '🙌', '✨', '🚀', '💪', '👀', '😎', '🤝', '📚', '🏆'];

export default function Feed({ setActivePage }: { setActivePage: (p: string) => void }) {
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const { isActive, monthlyPrice } = useSubscription();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [location, setLocation] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchFeed(); }, [user]);

  const fetchFeed = async () => {
    setLoading(true);
    const { data } = await supabase.from('posts')
      .select('*,profiles(username,full_name,avatar_url,is_verified)')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) setPosts(data as any);
    setLoading(false);
  };

  const handleMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const clearMedia = () => { setMediaFile(null); setMediaPreview(null); if (fileRef.current) fileRef.current.value = ''; };

  const handlePost = async () => {
    if (!user) return;
    if (profile?.is_suspended) {
      showToast('Your account is suspended. You cannot post.', 'error');
      return;
    }
    if (!isActive) {
      showToast('You need a premium subscription to post.', 'error');
      setActivePage('premium');
      return;
    }
    if (!caption.trim() && !mediaFile) return;
    setPosting(true);
    let mediaUrls: string[] = [];
    let postType: 'text' | 'image' | 'video' = 'text';

    if (mediaFile) {
      const ext = mediaFile.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('posts').upload(path, mediaFile);

      if (upErr) { showToast('Media upload failed: ' + upErr.message, 'error'); setPosting(false); return; }
      const { data: urlData } = supabase.storage.from('posts').getPublicUrl(path);
      mediaUrls = [urlData.publicUrl];
      postType = mediaFile.type.startsWith('video') ? 'video' : 'image';
    }

    const { error } = await supabase.from('posts').insert({
      user_id: user.id, caption: caption.trim() || null,
      media_urls: mediaUrls, post_type: postType,
      visibility, location_tag: location.trim() || null,
    });

    if (error) { showToast('Failed to post: ' + error.message, 'error'); }
    else {
      await supabase.from('profiles').update({ posts_count: (profile?.posts_count || 0) + 1 }).eq('id', user.id);
      await refreshProfile();
      setCaption(''); clearMedia(); setLocation(''); setShowLocation(false);
      showToast('Post published! 🚀');
      fetchFeed();
    }
    setPosting(false);
  };

  const visibilityIcons: Record<string, React.ReactNode> = {
    public: <Globe size={14} />, followers: <Users size={14} />, private: <Lock size={14} />
  };

  const initials = profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    || profile?.username?.[0]?.toUpperCase() || '?';

  return (
    <div>
      {/* Suspended banner */}
      {profile?.is_suspended && (
        <div style={{
          padding: 14, marginBottom: 16, borderRadius: 'var(--border-radius-md)',
          background: 'rgba(255, 107, 107, 0.12)', border: '1px solid rgba(255, 107, 107, 0.3)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Ban size={20} color="var(--coral)" />
          <div style={{ flex: 1, fontSize: '0.85rem' }}>
            <div style={{ fontWeight: 700 }}>Your account is suspended</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {profile.suspended_reason || 'You cannot post, like or comment. Contact support for more info.'}
            </div>
          </div>
        </div>
      )}

      {/* Create Post - paywall for free users */}
      {!isActive ? (
        <div className="create-post" style={{
          background: 'linear-gradient(135deg, rgba(76, 201, 240, 0.1) 0%, rgba(255, 107, 107, 0.08) 100%)',
          textAlign: 'center', padding: '32px 20px',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 12px',
            background: 'var(--gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 32px rgba(76, 201, 240, 0.3)',
          }}>
            <Crown size={28} color="white" />
          </div>
          <h3 style={{ marginBottom: 6, fontSize: '1.1rem' }}>Unlock Posting & More</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 14, maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
            Get premium for just <strong style={{ color: 'var(--neon-blue)' }}>₦{monthlyPrice}/month</strong> or use a promo code for free access.
          </p>
          <button className="btn btn-primary" onClick={() => setActivePage('premium')}>
            <Sparkles size={16} /> Upgrade to Premium
          </button>
        </div>
      ) : profile?.is_suspended ? (
        <div className="create-post" style={{ opacity: 0.5, textAlign: 'center', padding: 24 }}>
          <p style={{ color: 'var(--text-muted)' }}>Posting is disabled while your account is suspended.</p>
        </div>
      ) : (
        <div className="create-post">
          <div className="create-post-row">
            <div className="avatar-ring" style={{ padding: 2, flexShrink: 0 }}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} className="avatar avatar-md" alt="you" />
                : <div className="avatar-placeholder avatar-md" style={{ fontSize: '0.9rem', border: '2px solid var(--bg-primary)' }}>{initials}</div>}
            </div>
            <textarea
              className="create-post-input"
              placeholder={`What's on your mind, ${profile?.full_name?.split(' ')[0] || profile?.username}?`}
              value={caption} onChange={e => setCaption(e.target.value)}
              rows={caption.length > 80 ? 4 : 2}
            />
          </div>

          {mediaPreview && (
            <div style={{ position: 'relative', marginTop: 12, borderRadius: 'var(--border-radius-md)', overflow: 'hidden' }}>
              {mediaFile?.type.startsWith('video')
                ? <video src={mediaPreview} style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 'var(--border-radius-md)' }} controls />
                : <img src={mediaPreview} alt="preview" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 'var(--border-radius-md)', display: 'block' }} />}
              <button onClick={clearMedia} style={{
                position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.7)',
                border: 'none', borderRadius: '50%', width: 28, height: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white'
              }}><X size={14} /></button>
            </div>
          )}

          {showLocation && (
            <div className="input-group" style={{ marginTop: 10 }}>
              <MapPin size={14} className="input-icon" />
              <input className="input" placeholder="Add location..." value={location}
                onChange={e => setLocation(e.target.value)}
                style={{ padding: '8px 12px 8px 36px', fontSize: '0.85rem' }} />
            </div>
          )}

          <div className="create-post-tools">
            <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleMedia} />
            <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} title="Add image/video">
              <Image size={16} color="var(--neon-blue)" /> Photo
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowLocation(!showLocation)} title="Add location">
              <MapPin size={16} color="var(--coral)" />
            </button>

            <div style={{ position: 'relative' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEmoji(!showEmoji)}>
                <Smile size={16} color="var(--gold)" />
              </button>
              {showEmoji && (
                <div style={{
                  position: 'absolute', bottom: '110%', left: 0, background: '#1a1a2e',
                  border: '1px solid var(--glass-border)', borderRadius: 'var(--border-radius-md)',
                  padding: 12, display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 4,
                  boxShadow: 'var(--shadow-card)', zIndex: 50
                }}>
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => { setCaption(c => c + e); setShowEmoji(false); }}
                      style={{ fontSize: '1.2rem', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: 4, lineHeight: 1 }}>
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <select value={visibility} onChange={e => setVisibility(e.target.value as any)}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)',
                borderRadius: 999, padding: '5px 12px', color: 'var(--text-secondary)',
                fontSize: '0.8rem', cursor: 'pointer', outline: 'none', fontFamily: 'Inter,sans-serif',
              }}>
              <option value="public">🌐 Public</option>
              <option value="followers">👥 Followers</option>
              <option value="private">🔒 Private</option>
            </select>

            <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }}
              onClick={handlePost} disabled={posting || (!caption.trim() && !mediaFile)}>
              {posting ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : 'Post'}
            </button>
          </div>
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🌟</div>
          <h3 style={{ marginBottom: 8 }}>No posts yet</h3>
          <p>Be the first to share something!</p>
        </div>
      ) : (
        posts.map(p => (
          <PostCard key={p.id} post={p}
            onDelete={id => setPosts(prev => prev.filter(x => x.id !== id))}
            setActivePage={setActivePage} />
        ))
      )}
    </div>
  );
}
