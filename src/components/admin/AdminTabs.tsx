import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';

import { DollarSign, Tag, Activity, X, Copy, Power, Plus } from 'lucide-react';

export function PaymentsTab({ payments }: { payments: any[] }) {
    const success = payments.filter(p => p.status === 'success');
    const totalRevenue = success.reduce((s, p) => s + Number(p.amount), 0);

    return (
        <div>
            <div className="glass-card" style={{ padding: 20, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Total Revenue</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#4ade80' }}>₦{totalRevenue.toLocaleString()}</div>
                </div>
                <div style={{ height: 50, width: 1, background: 'var(--glass-border)' }} />
                <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Successful Payments</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{success.length}</div>
                </div>
                <div style={{ height: 50, width: 1, background: 'var(--glass-border)' }} />
                <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Failed</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--coral)' }}>{payments.filter(p => p.status === 'failed').length}</div>
                </div>
            </div>

            <div className="glass-card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: 16, borderBottom: '1px solid var(--glass-border)' }}>
                    <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <DollarSign size={18} className="gradient-text" /> All Payments
                    </h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                                <th style={{ padding: 12 }}>User</th>
                                <th style={{ padding: 12 }}>Amount</th>
                                <th style={{ padding: 12 }}>Status</th>
                                <th style={{ padding: 12 }}>Reference</th>
                                <th style={{ padding: 12 }}>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.length === 0 ? (
                                <tr><td colSpan={5} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>No payments yet</td></tr>
                            ) : payments.map(p => {
                                const user = p.profiles || {};
                                return (
                                    <tr key={p.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                        <td style={{ padding: 12 }}>
                                            <div style={{ fontWeight: 600 }}>@{user.username || 'unknown'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.full_name || ''}</div>
                                        </td>
                                        <td style={{ padding: 12, fontWeight: 700 }}>₦{Number(p.amount).toLocaleString()}</td>
                                        <td style={{ padding: 12 }}>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                                                background: p.status === 'success' ? 'rgba(74, 222, 128, 0.15)' :
                                                    p.status === 'failed' ? 'rgba(255, 107, 107, 0.15)' :
                                                        p.status === 'refunded' ? 'rgba(255, 193, 7, 0.15)' :
                                                            'rgba(255, 255, 255, 0.1)',
                                                color: p.status === 'success' ? '#4ade80' :
                                                    p.status === 'failed' ? 'var(--coral)' :
                                                        p.status === 'refunded' ? '#ffc107' : 'var(--text-muted)',
                                            }}>{p.status}</span>
                                        </td>
                                        <td style={{ padding: 12, fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {p.paystack_reference || '-'}
                                        </td>
                                        <td style={{ padding: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            {new Date(p.created_at).toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export function PromosTab({ promos, adminId, refresh }: { promos: any[]; adminId: string; refresh: () => void }) {
    const { showToast } = useToast();
    const [showModal, setShowModal] = useState(false);
    const [code, setCode] = useState('');
    const [desc, setDesc] = useState('');
    const [maxUses, setMaxUses] = useState(1);
    const [expiresAt, setExpiresAt] = useState('');
    const [planType, setPlanType] = useState<'monthly' | 'live'>('monthly');
    const [creating, setCreating] = useState(false);

    const planLabel = planType === 'live' ? '₦500 Live Streamer' : '₦300 Premium';

    const handleCreate = async () => {
        if (!code.trim()) return showToast('Code is required', 'error');
        setCreating(true);
        const { error } = await supabase.from('promo_codes').insert({
            code: code.trim().toUpperCase(),
            description: desc.trim() || `${planLabel} – ${code.trim().toUpperCase()}`,
            max_uses: maxUses,
            created_by: adminId,
            expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
            plan_type: planType,
        });
        setCreating(false);
        if (error) { showToast(error.message, 'error'); return; }
        showToast(`Promo code created! (${planLabel})`, 'success');
        setCode(''); setDesc(''); setMaxUses(1); setExpiresAt(''); setPlanType('monthly');
        setShowModal(false);
        refresh();
    };

    const handleToggle = async (p: any) => {
        const { error } = await supabase.from('promo_codes').update({ is_active: !p.is_active }).eq('id', p.id);
        if (error) showToast(error.message, 'error');
        else { showToast(`Code ${p.is_active ? 'deactivated' : 'activated'}`, 'success'); refresh(); }
    };

    const handleDelete = async (p: any) => {
        if (!confirm(`Delete promo code ${p.code}?`)) return;
        const { error } = await supabase.from('promo_codes').delete().eq('id', p.id);
        if (error) showToast(error.message, 'error');
        else { showToast('Deleted', 'success'); refresh(); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag size={18} className="gradient-text" /> Promo Codes
                </h3>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={16} /> New Code
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                {promos.length === 0 ? (
                    <div className="glass-card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', gridColumn: '1/-1' }}>
                        No promo codes yet. Create one to give users free premium access.
                    </div>
                ) : promos.map(p => (
                    <div key={p.id} className="glass-card" style={{ padding: 16, opacity: p.is_active ? 1 : 0.5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div style={{
                                fontFamily: 'monospace', fontSize: '1rem', fontWeight: 800, letterSpacing: 2,
                                padding: '6px 12px', background: 'var(--gradient-brand)', borderRadius: 6,
                                color: 'white', display: 'inline-flex', alignItems: 'center', gap: 8,
                            }}>
                                {p.code}
                                <button
                                    onClick={() => { navigator.clipboard.writeText(p.code); showToast('Copied!', 'success'); }}
                                    style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 4, padding: 2, cursor: 'pointer', color: 'white' }}
                                ><Copy size={12} /></button>
                            </div>
                            <span style={{
                                padding: '2px 8px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 700,
                                background: p.is_active ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 107, 107, 0.15)',
                                color: p.is_active ? '#4ade80' : 'var(--coral)',
                            }}>{p.is_active ? 'ACTIVE' : 'INACTIVE'}</span>
                        </div>
                        {/* Plan type badge */}
                        <div style={{ marginBottom: 6 }}>
                            <span style={{
                                padding: '2px 8px', borderRadius: 999, fontSize: '0.65rem', fontWeight: 700,
                                background: p.plan_type === 'live' ? 'rgba(167,139,250,0.18)' : 'rgba(76,201,240,0.15)',
                                color: p.plan_type === 'live' ? '#a78bfa' : 'var(--neon-blue)',
                                border: `1px solid ${p.plan_type === 'live' ? 'rgba(167,139,250,0.3)' : 'rgba(76,201,240,0.3)'}`,
                            }}>
                                {p.plan_type === 'live' ? '₦500 Live Streamer' : '₦300 Premium'}
                            </span>
                        </div>
                        {p.description && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '8px 0' }}>{p.description}</p>}
                        <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: 'var(--text-muted)', margin: '8px 0' }}>
                            <span>Uses: <strong>{p.times_used}/{p.max_uses}</strong></span>
                            {p.expires_at && <span>Expires: {new Date(p.expires_at).toLocaleDateString()}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
                            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => handleToggle(p)}>
                                <Power size={12} /> {p.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button className="btn btn-sm" style={{ flex: 1, background: 'rgba(255,107,107,0.15)', color: 'var(--coral)' }} onClick={() => handleDelete(p)}>
                                <X size={12} /> Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
                    <div className="modal" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-card)' }}>
                        <div className="modal-header">
                            <h3 className="modal-title" style={{ color: 'var(--text-primary)' }}>Create Promo Code</h3>
                            <button className="btn btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                            {/* Plan Type */}
                            <div>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8, display: 'block', fontWeight: 600 }}>Plan Type *</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    <button
                                        onClick={() => setPlanType('monthly')}
                                        style={{
                                            padding: '12px 10px', borderRadius: 10, border: '2px solid',
                                            borderColor: planType === 'monthly' ? 'var(--neon-blue)' : 'var(--glass-border)',
                                            background: planType === 'monthly' ? 'rgba(76,201,240,0.12)' : 'var(--bg-input)',
                                            color: planType === 'monthly' ? 'var(--neon-blue)' : 'var(--text-secondary)',
                                            cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', textAlign: 'center',
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        ₦300<br /><span style={{ fontSize: '0.72rem', fontWeight: 400 }}>Premium</span>
                                    </button>
                                    <button
                                        onClick={() => setPlanType('live')}
                                        style={{
                                            padding: '12px 10px', borderRadius: 10, border: '2px solid',
                                            borderColor: planType === 'live' ? '#a78bfa' : 'var(--glass-border)',
                                            background: planType === 'live' ? 'rgba(167,139,250,0.12)' : 'var(--bg-input)',
                                            color: planType === 'live' ? '#a78bfa' : 'var(--text-secondary)',
                                            cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem', textAlign: 'center',
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        ₦500<br /><span style={{ fontSize: '0.72rem', fontWeight: 400 }}>Live Streamer</span>
                                    </button>
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
                                    Selected: <strong style={{ color: planType === 'live' ? '#a78bfa' : 'var(--neon-blue)' }}>{planLabel}</strong>
                                </p>
                            </div>

                            {/* Promo Code */}
                            <div>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 600 }}>Code *</label>
                                <input
                                    className="input"
                                    value={code}
                                    onChange={e => setCode(e.target.value.toUpperCase())}
                                    placeholder="e.g. LAUNCH2026"
                                    style={{ letterSpacing: '2px', textTransform: 'uppercase' }}
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 600 }}>Description (optional)</label>
                                <input
                                    className="input"
                                    value={desc}
                                    onChange={e => setDesc(e.target.value)}
                                    placeholder={`e.g. ${planLabel} launch promo`}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 600 }}>Max Uses</label>
                                    <input
                                        className="input"
                                        type="number"
                                        min={1}
                                        value={maxUses}
                                        onChange={e => setMaxUses(Math.max(1, parseInt(e.target.value) || 1))}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 600 }}>Expires (optional)</label>
                                    <input
                                        className="input"
                                        type="date"
                                        value={expiresAt}
                                        onChange={e => setExpiresAt(e.target.value)}
                                        style={{ colorScheme: 'dark' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                <button className="btn btn-secondary w-full" onClick={() => setShowModal(false)}>Cancel</button>
                                <button className="btn btn-primary w-full" onClick={handleCreate} disabled={creating}>
                                    {creating ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : `Create ${planLabel}`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export function AuditTab({ actions }: { actions: any[] }) {
    return (
        <div>
            <h3 style={{ fontSize: '1rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={18} className="gradient-text" /> Admin Audit Log
            </h3>
            <div className="glass-card" style={{ overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                                <th style={{ padding: 12 }}>Admin</th>
                                <th style={{ padding: 12 }}>Action</th>
                                <th style={{ padding: 12 }}>Target</th>
                                <th style={{ padding: 12 }}>Details</th>
                                <th style={{ padding: 12 }}>When</th>
                            </tr>
                        </thead>
                        <tbody>
                            {actions.length === 0 ? (
                                <tr><td colSpan={5} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>No admin actions yet</td></tr>
                            ) : actions.map(a => {
                                const admin = a.profiles || {};
                                return (
                                    <tr key={a.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                        <td style={{ padding: 12 }}>
                                            <div style={{ fontWeight: 600 }}>@{admin.username || 'unknown'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{admin.full_name || ''}</div>
                                        </td>
                                        <td style={{ padding: 12 }}>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700,
                                                background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                                            }}>{a.action_type}</span>
                                        </td>
                                        <td style={{ padding: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            {a.target_user_id ? a.target_user_id.slice(0, 8) + '...' : '-'}
                                        </td>
                                        <td style={{ padding: 12, fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {a.details ? JSON.stringify(a.details) : '-'}
                                        </td>
                                        <td style={{ padding: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            {new Date(a.created_at).toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
