import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { OverviewTab } from './admin/OverviewTab';
import { UsersTab } from './admin/UsersTab';
import { PaymentsTab, PromosTab, AuditTab } from './admin/AdminTabs';
import { Shield, Users, DollarSign, BarChart3, Tag, Activity, Crown } from 'lucide-react';

type AdminTab = 'overview' | 'users' | 'payments' | 'promos' | 'audit';

export default function AdminPanel() {
    const { user, profile: myProfile } = useAuth();
    const [tab, setTab] = useState<AdminTab>('overview');
    const [users, setUsers] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [promos, setPromos] = useState<any[]>([]);
    const [actions, setActions] = useState<any[]>([]);

    const fetchAll = useCallback(async () => {
        const [u, p, pr, ac] = await Promise.all([
            supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(500),
            supabase.from('payments').select('*, profiles:profiles!payments_user_id_fkey(username, full_name, avatar_url)').order('created_at', { ascending: false }).limit(200),
            supabase.from('promo_codes').select('*').order('created_at', { ascending: false }),
            supabase.from('admin_actions').select('*, profiles:profiles!admin_actions_admin_id_fkey(username, full_name, avatar_url)').order('created_at', { ascending: false }).limit(100),
        ]);
        setUsers(u.data || []);
        setPayments(p.data || []);
        setPromos(pr.data || []);
        setActions(ac.data || []);
    }, []);

    useEffect(() => { if (myProfile?.is_admin) fetchAll(); }, [myProfile, fetchAll]);

    if (!myProfile?.is_admin) {
        return (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                <Shield size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
                <h2>Admin Access Required</h2>
                <p>You do not have permission to view this page.</p>
            </div>
        );
    }

    const tabs: { id: AdminTab; label: string; icon: any }[] = [
        { id: 'overview', label: 'Overview', icon: BarChart3 },
        { id: 'users', label: 'Users', icon: Users },
        { id: 'payments', label: 'Payments', icon: DollarSign },
        { id: 'promos', label: 'Promo Codes', icon: Tag },
        { id: 'audit', label: 'Audit Log', icon: Activity },
    ];

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 4px' }}>
            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: 'var(--gradient-brand)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Shield size={22} color="white" />
                </div>
                <div>
                    <h1 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                        Admin Panel
                        <Crown size={18} color="var(--neon-blue)" />
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Manage your KSU Connect platform</p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 4, marginBottom: 20, overflowX: 'auto', borderBottom: '1px solid var(--glass-border)', paddingBottom: 4 }}>
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        style={{
                            padding: '10px 16px',
                            background: 'transparent',
                            border: 'none',
                            color: tab === t.id ? 'var(--neon-blue)' : 'var(--text-muted)',
                            borderBottom: tab === t.id ? '2px solid var(--neon-blue)' : '2px solid transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            whiteSpace: 'nowrap',
                            marginBottom: -5,
                        }}
                    >
                        <t.icon size={16} />
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'overview' && <OverviewTab users={users} payments={payments} />}
            {tab === 'users' && <UsersTab users={users} adminId={user!.id} refresh={fetchAll} />}
            {tab === 'payments' && <PaymentsTab payments={payments} />}
            {tab === 'promos' && <PromosTab promos={promos} adminId={user!.id} refresh={fetchAll} />}
            {tab === 'audit' && <AuditTab actions={actions} />}
        </div>
    );
}
