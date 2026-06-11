import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Edit2, MapPin, Link, Lock, Unlock, Camera, Grid, Image, Heart, X, Check, BadgeCheck } from 'lucide-react';
import PostCard from './PostCard';

interface Profile {
  id: string; username: string; full_name: string | null; bio: string | null;
  avatar_url: string | null; cover_url: string | null; location: string | null;
  website: string | null; is_private: boolean; is_verified: boolean;
  followers_count: number; following_count: number; posts_count: number;
}

interface Post {
  id: string; user_id: string; caption: string | null; media_urls: string[];
  post_type: string; likes_count: number; comments_count: number; created_at: string;
  visibility: string; location_tag: string | null;
  profiles: { username: string; full_name: string | null; avatar_url: string | null; is_verified: boolean; };
}

const TABS = ['Posts', 'Media', 'Liked'];

export default function ProfilePage({ userId, setActivePage }: { userId?: string; setActivePage: (p: string) => void }) {
  const { user, profile: myProfile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const targetId = userId || user?.id;
  const isOwn = !userId || userId === user?.id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState('Posts');
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editPrivate, setEditPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (targetId) fetchProfile(); }, [targetId]);

  const fetchProfile = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').eq('id', targetId).single();
    if (data) {
      setProfile(data);
      setEditName(data.full_name || '');
      setEditBio(data.bio || '');
      setEditLocation(data.location || '');
      setEditWebsite(data.website || '');
      setEditPrivate(data.is_private);
    }

    // Check follow status
    if (user && !isOwn) {
      const { data: f } = await supabase.from('follows')
        .select('id').eq('follower_id', user.id).eq('following_id', targetId).single();
      setIsFollowing(!!f);
    }

    // Fetch posts
    const { data: userPosts } = await supabase.from('posts')
      .select('*,profiles(username,full_name,avatar_url,is_verified)')
      .eq('user_id', targetId)
      .order('created_at', { ascending: false });
    if (userPosts) setPosts(userPosts as any);

    setLoading(false);
  };

  const fetchLiked = async () => {
    if (!targetId) return;
    const { data: likes } = await supabase.from('likes').select('target_id').eq('user_id', targetId).eq('target_type', 'post');
    if (!likes?.length) return;
    const ids = likes.map(l => l.target_id);
    const { data } = await supabase.from('posts')
      .select('*,profiles(username,full_name,avatar_url,is_verified)')
      .in('id', ids).order('created_at', { ascending: false });
    if (data) setLikedPosts(data as any);
  };

  const handleTabChange = (t: string) => {
    setTab(t);
    if (t === 'Liked' && likedPosts.length === 0) fetchLiked();
  };

  const handleFollow = async () => {
    if (!user || isOwn) return;
    try {
      if (isFollowing) {
        await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetId);
        await supabase.from('profiles').update({ followers_count: Math.max(0, (profile?.followers_count || 1) - 1) }).eq('id', targetId);
        await supabase.from('profiles').update({ following_count: Math.max(0, (myProfile?.following_count || 1) - 1) }).eq('id', user.id);
        setIsFollowing(false);
        setProfile(p => p ? { ...p, followers_count: Math.max(0, p.followers_count - 1) } : p);
        await refreshProfile();
        showToast('Unfollowed');
      } else {
        await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId, status: 'accepted' });
        await supabase.from('profiles').update({ followers_count: (profile?.followers_count || 0) + 1 }).eq('id', targetId);
        await supabase.from('profiles').update({ following_count: (myProfile?.following_count || 0) + 1 }).eq('id', user.id);
        setIsFollowing(true);
        setProfile(p => p ? { ...p, followers_count: p.followers_count + 1 } : p);
        await supabase.from('notifications').insert({ user_id: targetId, sender_id: user.id, type: 'follow', target_id: user.id, is_read: false });
        await refreshProfile();
        showToast('Following! 🎉');
      }
    } catch (err) {
      showToast('Failed to follow/unfollow. Please try again.', 'error');
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({
      full_name: editName.trim() || null,
      bio: editBio.trim() || null,
      location: editLocation.trim() || null,
      website: editWebsite.trim() || null,
      is_private: editPrivate,
    }).eq('id', user.id);
    if (error) showToast('Failed to save: ' + error.message, 'error');
    else { showToast('Profile updated! ✨'); await refreshProfile(); fetchProfile(); setShowEditModal(false); }
    setSaving(false);
  };

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const path = `avatars/${user.id}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) return showToast('Upload failed', 'error');
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    await supabase.from('profiles').update({ avatar_url: data.publicUrl + '?t=' + Date.now() }).eq('id', user.id);
    await refreshProfile();
    fetchProfile();
    showToast('Avatar updated! 📸');
  };

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const path = `covers/${user.id}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) return showToast('Cover upload failed', 'error');
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    await supabase.from('profiles').update({ cover_url: data.publicUrl + '?t=' + Date.now() }).eq('id', user.id);
    fetchProfile();
    showToast('Cover updated! 🖼️');
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!profile) return <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>User not found</div>;

  const initials = profile.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    || profile.username[0].toUpperCase();

  const currentPosts = tab === 'Liked' ? likedPosts : tab === 'Media'
    ? posts.filter(p => p.media_urls?.length > 0) : posts;

  return (
    <div>
      {/* Cover */}
      <div className="profile-cover" style={{ borderRadius: 'var(--border-radius-lg) var(--border-radius-lg) 0 0', position: 'relative' }}>
        {profile.cover_url
          ? <img src={profile.cover_url} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', background: 'var(--gradient-brand)', opacity: 0.7 }} />}
        {isOwn && (
          <>
            <input ref={coverRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUploadCover} />
            <button onClick={() => coverRef.current?.click()} style={{
              position: 'absolute', bottom: 12, right: 12, background: 'rgba(0,0,0,0.6)',
              border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
              color: 'white', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem',
            }}><Camera size={14} /> Edit Cover</button>
          </>
        )}
      </div>

      {/* Profile Info */}
      <div className="profile-info">
        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 8 }}>
          <div style={{ position: 'relative' }}>
            <div className="avatar-ring" style={{ padding: 3, display: 'inline-block', background: 'var(--gradient-brand)', borderRadius: '50%' }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} className="avatar" style={{ width: 90, height: 90, border: '3px solid var(--bg-primary)' }} alt={profile.username} />
                : <div className="avatar-placeholder" style={{ width: 90, height: 90, fontSize: '2rem', border: '3px solid var(--bg-primary)' }}>{initials}</div>}
            </div>
            {isOwn && (
              <>
                <input ref={avatarRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUploadAvatar} />
                <button onClick={() => avatarRef.current?.click()} style={{
                  position: 'absolute', bottom: 4, right: 4, background: 'var(--coral)',
                  border: 'none', borderRadius: '50%', width: 28, height: 28,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                }}><Camera size={12} /></button>
              </>
            )}
          </div>
          {isOwn
            ? <button className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(true)}>
              <Edit2 size={14} /> Edit Profile
            </button>
            : <div style={{ display: 'flex', gap: 8 }}>
              <button className={`btn btn-sm ${isFollowing ? 'btn-secondary' : 'btn-primary'}`} onClick={handleFollow}>
                {isFollowing ? 'Following ✓' : 'Follow'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setActivePage(`messages:${profile.id}`)}>Message</button>
            </div>}
        </div>

        {/* Name & bio */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontSize: '1.3rem' }}>{profile.full_name || profile.username}</h2>
            {profile.is_verified && <BadgeCheck size={20} color="var(--neon-blue)" />}
            {profile.is_private && <Lock size={14} color="var(--text-muted)" />}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>@{profile.username}</p>
          {profile.bio && <p style={{ marginTop: 8, fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--text-secondary)' }}>{profile.bio}</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
            {profile.location && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={13} />{profile.location}</span>}
            {profile.website && <a href={profile.website} target="_blank" rel="noreferrer" style={{ fontSize: '0.82rem', color: 'var(--neon-blue)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}><Link size={13} />{profile.website.replace(/^https?:\/\//, '')}</a>}
          </div>
        </div>

        {/* Stats */}
        <div className="profile-stats">
          {[
            { label: 'Posts', value: profile.posts_count },
            { label: 'Followers', value: profile.followers_count },
            { label: 'Following', value: profile.following_count },
          ].map(s => (
            <div key={s.label} className="profile-stat">
              <div className="count gradient-text">{s.value}</div>
              <div className="label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ margin: '20px 0', display: 'flex', gap: 4, justifyContent: 'center' }}>
        <div className="tabs">
          {TABS.map(t => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => handleTabChange(t)}>
              {t === 'Posts' && <Grid size={14} />}
              {t === 'Media' && <Image size={14} />}
              {t === 'Liked' && <Heart size={14} />}
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Posts */}
      {currentPosts.length === 0
        ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>
            {tab === 'Liked' ? '❤️' : tab === 'Media' ? '📷' : '📝'}
          </div>
          <p>No {tab.toLowerCase()} yet</p>
        </div>
        : currentPosts.map(p => (
          <PostCard key={p.id} post={p}
            onDelete={id => setPosts(prev => prev.filter(x => x.id !== id))}
            setActivePage={setActivePage} />
        ))
      }

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowEditModal(false); }}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Edit Profile</h3>
              <button className="btn btn-icon" onClick={() => setShowEditModal(false)}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Display Name</label>
                <input className="input" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Your full name" />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Bio</label>
                <textarea className="input" value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="Tell something about yourself..." style={{ minHeight: 80 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Location</label>
                  <div className="input-group">
                    <MapPin size={14} className="input-icon" />
                    <input className="input" value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="City, Country" />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Website</label>
                  <div className="input-group">
                    <Link size={14} className="input-icon" />
                    <input className="input" value={editWebsite} onChange={e => setEditWebsite(e.target.value)} placeholder="https://..." />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--glass-bg)', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--glass-border)' }}>
                {editPrivate ? <Lock size={16} color="var(--coral)" /> : <Unlock size={16} color="var(--neon-blue)" />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Private Account</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Only approved followers can see your posts</div>
                </div>
                <button onClick={() => setEditPrivate(!editPrivate)} style={{
                  width: 44, height: 24, borderRadius: 999, background: editPrivate ? 'var(--coral)' : 'rgba(255,255,255,0.15)',
                  border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                }}>
                  <span style={{
                    position: 'absolute', top: 2, left: editPrivate ? 22 : 2, width: 20, height: 20,
                    borderRadius: '50%', background: 'white', transition: 'left 0.2s', display: 'block',
                  }} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button className="btn btn-secondary w-full" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button className="btn btn-primary w-full" onClick={handleSaveProfile} disabled={saving}>
                  {saving ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <><Check size={16} /> Save Changes</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
