import React, { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { Search, X, Shield, ShieldOff, Ban, Trash2 } from 'lucide-react';

interface ProfileRow {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    is_admin: boolean;
    is_suspended: boolean;
    suspended_reason: string | null;
    suspended_at: string | null;
    followers_count: number;
    following_count: number;
    posts_count: number;
    created_at: string;
}

export function UsersTab({ users, adminId, refresh }: { users: ProfileRow[]; adminId: string; refresh: () => void }) {
    const { showToast } = useToast();
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'suspended' | 'admins'>('all');
    const [suspendModal, setSuspendModal] = useState<ProfileRow | null>(null);
    const [suspendReason, setSuspendReason] = useState('');

    const filtered = users.filter(u => {
        if (search) {
            const q = search.toLowerCase();
            if (!u.username.toLowerCase().includes(q) && !(u.full_name?.toLowerCase().includes(q))) return false;
        }
        if (filter === 'suspended' && !u.is_suspended) return false;
        if (filter === 'admins' && !u.is_admin) return false;
        return true;
    });

    const logAction = async (action_type: string, target_user_id: string, details: any = {}) => {
        await supabase.from('admin_actions').insert({ admin_id: adminId, action_type, target_user_id, details });
    };

    const handleSuspend = async () => {
        if (!suspendModal) return;
        const reason = suspendReason.trim() || 'Violated community guidelines';
        const { error } = await supabase.from('profiles').update({
            is_suspended: true,
            suspended_reason: reason,
            suspended_at: new Date().toISOString(),
        }).eq('id', suspendModal.id);
        if (error) { showToast(error.message, 'error'); return; }
        await logAction('suspend_user', suspendModal.id, { reason });
        showToast(`${suspendModal.username} suspended`, 'success');
        setSuspendModal(null);
        setSuspendReason('');
        refresh();
    };

    const handleUnsuspend = async (u: ProfileRow) => {
        if (!confirm(`Unsuspend @${u.username}?`)) return;
        const { error } = await supabase.from('profiles').update({
            is_suspended: false,
            suspended_reason: null,
            suspended_at: null,
        }).eq('id', u.id);
        if (error) { showToast(error.message, 'error'); return; }
        await logAction('unsuspend_user', u.id);
        showToast(`${u.username} unsuspended`, 'success');
        refresh();
    };

    const handleToggleAdmin = async (u: ProfileRow) => {
        const action = u.is_admin ? 'remove' : 'grant';
        if (!confirm(`${action === 'grant' ? 'Grant' : 'Remove'} admin privileges for @${u.username}?`)) return;
        const { error } = await supabase.from('profiles').update({ is_admin: !u.is_admin }).eq('id', u.id);
        if (error) { showToast(error.message, 'error'); return; }
        await logAction(action === 'grant' ? 'grant_admin' : 'remove_admin', u.id);
        showToast(`Admin ${action === 'grant' ? 'granted to' : 'removed from'} @${u.username}`, 'success');
        refresh();
    };

    const handleDeleteUser = async (u: ProfileRow) => {
        if (!confirm(`PERMANENTLY delete @${u.username}? This cannot be undone!`)) return;
        if (!confirm('Are you absolutely sure?')) return;
        const { error: pErr } = await supabase.from('profiles').delete().eq('id', u.id);
        if (pErr) { showToast(pErr.message, 'error'); return; }
        await logAction('delete_user', u.id);
        showToast(`User @${u.username} deleted`, 'success');
        refresh();
    };

    return (
        <div>
            <div className="glass-card" style={{ padding: 12, marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        className="input"
                        style={{ paddingLeft: 36 }}
                        placeholder="Search by username or name..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                    {(['all', 'admins', 'suspended'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="glass-card" style={{ overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                                <th style={{ padding: 12 }}>User</th>
                                <th style={{ padding: 12 }}>Status</th>
                                <th style={{ padding: 12 }}>Joined</th>
                                <th style={{ padding: 12 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={4} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>No users found</td></tr>
                            ) : filtered.map(u => (
                                <UserRow
                                    key={u.id}
                                    user={u}
                                    currentAdminId={adminId}
                                    onSuspend={() => { setSuspendModal(u); setSuspendReason(''); }}
                                    onUnsuspend={() => handleUnsuspend(u)}
                                    onToggleAdmin={() => handleToggleAdmin(u)}
                                    onDelete={() => handleDeleteUser(u)}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {suspendModal && (
                <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSuspendModal(null); }}>
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">Suspend @{suspendModal.username}</h3>
                            <button className="btn btn-icon" onClick={() => setSuspendModal(null)}><X size={18} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                They will not be able to post, like, or comment. They can still log in and view content.
                            </p>
                            <div>
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Reason (optional)</label>
                                <textarea
                                    className="input"
                                    value={suspendReason}
                                    onChange={e => setSuspendReason(e.target.value)}
                                    placeholder="e.g. Spam, harassment..."
                                    style={{ minHeight: 80 }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                <button className="btn btn-secondary w-full" onClick={() => setSuspendModal(null)}>Cancel</button>
                                <button className="btn w-full" style={{ background: 'var(--coral)', color: 'white' }} onClick={handleSuspend}>
                                    <Ban size={14} /> Suspend User
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function UserRow({ user, currentAdminId, onSuspend, onUnsuspend, onToggleAdmin, onDelete }: {
    user: ProfileRow;
    currentAdminId: string;
    onSuspend: () => void;
    onUnsuspend: () => void;
    onToggleAdmin: () => void;
    onDelete: () => void;
}) {
    return (
        <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
            <td style={{ padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {user.avatar_url ? (
                        <img src={user.avatar_url} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} alt={user.username} />
                    ) : (
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>
                            {user.username[0].toUpperCase()}
                        </div>
                    )}
                    <div>
                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                            @{user.username}
                            {user.is_admin && <span style={{ color: 'var(--neon-blue)', fontSize: '0.75rem' }}>👑</span>}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.full_name || 'No name'}</div>
                    </div>
                </div>
            </td>
            <td style={{ padding: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {user.is_suspended ? (
                        <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: 'rgba(255, 107, 107, 0.15)', color: 'var(--coral)', display: 'inline-block', width: 'fit-content' }}>
                            SUSPENDED
                        </span>
                    ) : (
                        <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, background: 'rgba(74, 222, 128, 0.15)', color: '#4ade80', display: 'inline-block', width: 'fit-content' }}>
                            ACTIVE
                        </span>
                    )}
                    {user.is_suspended && user.suspended_reason && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', maxWidth: 200 }}>{user.suspended_reason}</div>
                    )}
                </div>
            </td>
            <td style={{ padding: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {new Date(user.created_at).toLocaleDateString()}
            </td>
            <td style={{ padding: 12 }}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {user.is_suspended ? (
                        <button className="btn btn-secondary btn-sm" onClick={onUnsuspend} title="Unsuspend">
                            <Shield size={12} />
                        </button>
                    ) : (
                        <button className="btn btn-sm" style={{ background: 'rgba(255, 193, 7, 0.15)', color: '#ffc107' }} onClick={onSuspend} title="Suspend">
                            <Ban size={12} />
                        </button>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={onToggleAdmin} title={user.is_admin ? 'Remove admin' : 'Make admin'}>
                        {user.is_admin ? <ShieldOff size={12} /> : <Shield size={12} />}
                    </button>
                    {user.id !== currentAdminId && (
                        <button className="btn btn-sm" style={{ background: 'rgba(255, 107, 107, 0.15)', color: 'var(--coral)' }} onClick={onDelete} title="Delete">
                            <Trash2 size={12} />
                        </button>
                    )}
                </div>
            </td>
        </tr>
    );
}
