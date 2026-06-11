import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ArrowLeft, BadgeCheck } from 'lucide-react';

interface UserProfile {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    is_verified: boolean;
    followers_count: number;
}

type FollowEntry = {
    profiles: UserProfile;
};

export default function FollowersList({
    userId,
    type,
    setActivePage,
}: {
    userId: string;
    type: 'followers' | 'following';
    setActivePage: (p: string) => void;
}) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchList();
    }, [userId, type]);

    const fetchList = async () => {
        setLoading(true);
        try {
            if (type === 'followers') {
                // Get users who follow this user
                const { data: follows } = await supabase
                    .from('follows')
                    .select('follower_id')
                    .eq('following_id', userId)
                    .eq('status', 'accepted');

                if (follows && follows.length > 0) {
                    const ids = follows.map(f => f.follower_id);
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id,username,full_name,avatar_url,is_verified,followers_count')
                        .in('id', ids);
                    if (profiles) setUsers(profiles);
                }
            } else {
                // Get users this user follows
                const { data: follows } = await supabase
                    .from('follows')
                    .select('following_id')
                    .eq('follower_id', userId)
                    .eq('status', 'accepted');

                if (follows && follows.length > 0) {
                    const ids = follows.map(f => f.following_id);
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id,username,full_name,avatar_url,is_verified,followers_count')
                        .in('id', ids);
                    if (profiles) setUsers(profiles);
                }
            }

            // Get current user's following list for follow/unfollow buttons
            if (user) {
                const { data: myFollowing } = await supabase
                    .from('follows')
                    .select('following_id')
                    .eq('follower_id', user.id);
                if (myFollowing) {
                    setFollowingIds(new Set(myFollowing.map(f => f.following_id)));
                }
            }
        } catch (err) {
            console.error('Error fetching list:', err);
            showToast('Failed to load list', 'error');
        }
        setLoading(false);
    };

    const handleFollowToggle = async (targetId: string) => {
        if (!user) return;
        const isFollowing = followingIds.has(targetId);
        try {
            if (isFollowing) {
                await supabase.from('follows').delete()
                    .eq('follower_id', user.id).eq('following_id', targetId);
                setFollowingIds(prev => {
                    const next = new Set(prev);
                    next.delete(targetId);
                    return next;
                });
            } else {
                await supabase.from('follows').insert({
                    follower_id: user.id, following_id: targetId, status: 'accepted'
                });
                setFollowingIds(prev => new Set([...prev, targetId]));
            }
        } catch (err) {
            console.error('Follow toggle error:', err);
        }
    };

    const getInitials = (name: string | null, username: string) =>
        name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || username[0].toUpperCase();

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <button
                    onClick={() => setActivePage(`profile:${userId}`)}
                    style={{
                        background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)',
                        borderRadius: '50%', width: 36, height: 36, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        color: 'var(--text-secondary)', flexShrink: 0,
                    }}
                >
                    <ArrowLeft size={18} />
                </button>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                    {type === 'followers' ? 'Followers' : 'Following'}
                </h2>
            </div>

            {/* List */}
            {loading ? (
                <div className="loading-center"><div className="spinner" /></div>
            ) : users.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>
                        {type === 'followers' ? '👥' : '👤'}
                    </div>
                    <p>{type === 'followers' ? 'No followers yet' : 'Not following anyone yet'}</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {users.map(u => (
                        <div
                            key={u.id}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 12, padding: '12px',
                                borderRadius: 'var(--border-radius-md)', cursor: 'pointer',
                                transition: 'background 0.15s',
                            }}
                            onClick={() => setActivePage(`profile:${u.id}`)}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                            {/* Avatar */}
                            {u.avatar_url ? (
                                <img
                                    src={u.avatar_url}
                                    alt={u.username}
                                    style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                                />
                            ) : (
                                <div
                                    className="avatar-placeholder"
                                    style={{ width: 44, height: 44, fontSize: '0.85rem', flexShrink: 0 }}
                                >
                                    {getInitials(u.full_name, u.username)}
                                </div>
                            )}

                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                        {u.full_name || u.username}
                                    </span>
                                    {u.is_verified && <BadgeCheck size={14} color="var(--neon-blue)" />}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    @{u.username}
                                </div>
                            </div>

                            {/* Follow button */}
                            {user && u.id !== user.id && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleFollowToggle(u.id);
                                    }}
                                    className={`btn btn-sm ${followingIds.has(u.id) ? 'btn-secondary' : 'btn-primary'}`}
                                    style={{ flexShrink: 0 }}
                                >
                                    {followingIds.has(u.id) ? 'Following' : 'Follow'}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}