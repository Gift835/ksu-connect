import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Search, Grid, Image, Video, TrendingUp } from 'lucide-react';

interface Post {
  id: string; user_id: string; caption: string | null;
  media_urls: string[]; post_type: string; likes_count: number; comments_count: number;
  profiles: { username: string; avatar_url: string | null; };
}

const FILTERS = [
  { id: 'all', label: 'All', icon: Grid },
  { id: 'image', label: 'Photos', icon: Image },
  { id: 'video', label: 'Videos', icon: Video },
  { id: 'trending', label: 'Trending', icon: TrendingUp },
];

export default function Explore({ setActivePage }: { setActivePage: (p: string) => void }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => { fetchPosts(); }, [filter]);

  const fetchPosts = async () => {
    setLoading(true);
    let q = supabase.from('posts')
      .select('id,user_id,caption,media_urls,post_type,likes_count,comments_count,profiles(username,avatar_url)')
      .eq('visibility', 'public')
      .not('media_urls', 'eq', '{}');

    if (filter === 'image') q = q.eq('post_type', 'image');
    else if (filter === 'video') q = q.eq('post_type', 'video');
    else if (filter === 'trending') q = q.order('likes_count', { ascending: false });
    else q = q.order('created_at', { ascending: false });

    const { data } = await q.limit(40);
    if (data) setPosts(data as any);
    setLoading(false);
  };

  const filtered = query.trim()
    ? posts.filter(p => p.caption?.toLowerCase().includes(query.toLowerCase()) || p.profiles?.username?.toLowerCase().includes(query.toLowerCase()))
    : posts;

  // Split into two columns for masonry
  const col1 = filtered.filter((_, i) => i % 2 === 0);
  const col2 = filtered.filter((_, i) => i % 2 === 1);

  const renderThumb = (post: Post) => (
    <div key={post.id} className="masonry-item" onClick={() => setActivePage(`post:${post.id}`)}>
      {post.post_type === 'video'
        ? <div style={{ background: 'rgba(168,85,247,0.2)', minHeight: 150, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Video size={32} color="var(--neon-purple)" />
          </div>
        : <img src={post.media_urls[0]} alt={post.caption || 'post'}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
      <div className="masonry-overlay">
        <div style={{ display: 'flex', gap: 12, color: 'white', fontSize: '0.8rem' }}>
          <span>❤️ {post.likes_count}</span>
          <span>💬 {post.comments_count}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Search */}
      <div className="input-group" style={{ marginBottom: 16 }}>
        <Search size={16} className="input-icon" />
        <input className="input" placeholder="Search posts, people, hashtags..."
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`btn btn-sm ${filter === f.id ? 'btn-primary' : 'btn-secondary'}`}>
            <f.icon size={14} /> {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔭</div>
          <h3>Nothing to explore yet</h3>
          <p style={{ marginTop: 8 }}>Posts with images/videos will appear here</p>
        </div>
      ) : (
        <div className="masonry-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {col1.map(renderThumb)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {col2.map(renderThumb)}
          </div>
        </div>
      )}
    </div>
  );
}
