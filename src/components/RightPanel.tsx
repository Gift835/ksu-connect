import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { TrendingUp, Users } from 'lucide-react';

interface Profile {
  id: string; username: string; full_name: string | null;
  avatar_url: string | null; is_verified: boolean; followers_count: number;
}

interface Trend { tag: string; count: number; }

export default function RightPanel({ setActivePage }: { setActivePage: (p: string) => void }) {
  const { profile: me, user } = useAuth();
  const { showToast } = useToast();
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    fetchSuggestions();
    fetchTrends();
  }, [user]);

  const fetchSuggestions = async () => {
    if (!user) return;
    const { data: follows } = await supabase.from('follows')
      .select('following_id').eq('follower_id', user.id);
    const followingIds = follows?.map(f => f.following_id) || [];
    followingIds.push(user.id);

    const { data } = await supabase.from('profiles')
      .select('id,username,full_name,avatar_url,is_verified,followers_count')
      .not('id', 'in', `(${followingIds.join(',')})`)
      .order('followers_count', { ascending: false })
      .limit(5);
    if (data) setSuggestions(data);
  };

  const fetchTrends = async () => {
    // Extract hashtags from all public posts' captions
    const { data: posts } = await supabase
      .from('posts')
      .select('caption, likes_count')
      .eq('visibility', 'public')
      .not('caption', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500);

    if (!posts || posts.length === 0) {
      setTrends([]);
      return;
    }

    // Count hashtag occurrences
    const tagCounts: Record<string, number> = {};
    for (const p of posts) {
      if (!p.caption) continue;
      const matches = p.caption.match(/#[\w]+/g);
      if (!matches) continue;
      for (const tag of matches) {
        const lower = tag.toLowerCase();
        tagCounts[lower] = (tagCounts[lower] || 0) + 1;
      }
    }

    // Sort by count and take top 6
    const sorted = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    setTrends(sorted);
  };

  const handleFollow = async (targetId: string) => {
    if (!user) return;
    if (following.has(targetId)) {
      await supabase.from('follows').delete()
        .eq('follower_id', user.id).eq('following_id', targetId);
      setFollowing(prev => { const s = new Set(prev); s.delete(targetId); return s; });
      showToast('Unfollowed');
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId, status: 'accepted' });
      setFollowing(prev => new Set([...prev, targetId]));
      showToast('Following! 🎉');
    }
  };

  return (
    <div className="app-right">
      {/* Suggested Users */}
      <div className="glass-card-sm" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Users size={16} color="var(--coral)" />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>People to Follow</span>
        </div>
        {suggestions.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '8px 0' }}>
            No suggestions yet
          </p>
        )}
        {suggestions.map(s => (
          <div key={s.id} className="suggest-item">
            <div style={{ cursor: 'pointer' }} onClick={() => setActivePage(`profile:${s.id}`)}>
              {s.avatar_url
                ? <img src={s.avatar_url} className="avatar avatar-sm" alt={s.username} />
                : <div className="avatar-placeholder avatar-sm" style={{ fontSize: '0.75rem' }}>
                  {s.username[0].toUpperCase()}
                </div>}
            </div>
            <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setActivePage(`profile:${s.id}`)}>
              <div style={{ fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 3 }}>
                <span className="truncate">{s.username}</span>
                {s.is_verified && <span style={{ color: 'var(--neon-blue)', fontSize: '0.7rem', flexShrink: 0 }}>✓</span>}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.followers_count} followers</div>
            </div>
            <button
              className={`btn btn-sm ${following.has(s.id) ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => handleFollow(s.id)}
              style={{ fontSize: '0.72rem', padding: '5px 12px' }}>
              {following.has(s.id) ? 'Following' : 'Follow'}
            </button>
          </div>
        ))}
      </div>

      {/* Trending - real data from posts */}
      <div className="glass-card-sm" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <TrendingUp size={16} color="var(--neon-blue)" />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Trending</span>
        </div>
        {trends.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '8px 0' }}>
            No trending hashtags yet
          </p>
        ) : (
          trends.map((t, i) => (
            <div key={t.tag} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: i < trends.length - 1 ? '1px solid var(--glass-border)' : 'none',
              cursor: 'pointer',
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--neon-blue)' }}>{t.tag}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.count} {t.count === 1 ? 'post' : 'posts'}</div>
              </div>
              <span style={{
                fontSize: '0.7rem', padding: '2px 8px', borderRadius: 999,
                background: 'rgba(78,205,196,0.1)', color: 'var(--neon-blue)',
                border: '1px solid rgba(78,205,196,0.2)',
              }}>#{i + 1}</span>
            </div>
          ))
        )}
      </div>

      {/* Stats card for current user */}
      {me && (
        <div className="glass-card-sm" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 12 }}>Your Stats</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
            {[
              { label: 'Posts', value: me.posts_count },
              { label: 'Followers', value: me.followers_count },
              { label: 'Following', value: me.following_count },
            ].map(s => (
              <div key={s.label} style={{
                padding: '10px 6px', background: 'var(--glass-bg)',
                borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--glass-border)',
              }}>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--coral)' }}>{s.value}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
