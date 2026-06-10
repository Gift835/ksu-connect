import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { DollarSign, Users, UserCheck, TrendingUp, Activity, MessageSquare, Mail, Ban } from 'lucide-react';

interface ProfileRow {
    id: string;
    is_admin: boolean;
    is_suspended: boolean;
    posts_count: number;
}

export function OverviewTab({ users, payments }: { users: ProfileRow[]; payments: any[] }) {
    const totalUsers = users.length;
    const suspended = users.filter(u => u.is_suspended).length;
    const admins = users.filter(u => u.is_admin).length;
    const totalPosts = users.reduce((s, u) => s + (u.posts_count || 0), 0);
    const successPayments = payments.filter(p => p.status === 'success');
    const totalRevenue = successPayments.reduce((s, p) => s + Number(p.amount), 0);
    const activeSubs = new Set(successPayments.map(p => p.user_id).filter(Boolean)).size;

    const days: { date: string; amount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const next = new Date(d);
        next.setDate(next.getDate() + 1);
        const amount = successPayments.filter(p => {
            const pd = new Date(p.created_at);
            return pd >= d && pd < next;
        }).reduce((s, p) => s + Number(p.amount), 0);
        days.push({ date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), amount });
    }
    const maxRev = Math.max(1, ...days.map(d => d.amount));

    const [extras, setExtras] = useState({ comments: 0, messages: 0 });
    useEffect(() => {
        Promise.all([
            supabase.from('comments').select('*', { count: 'exact', head: true }),
            supabase.from('messages').select('*', { count: 'exact', head: true }),
        ]).then(([c, m]) => setExtras({ comments: c.count || 0, messages: m.count || 0 }));
    }, []);

    return (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
                <StatCard icon={Users} label="Total Users" value={totalUsers} color="var(--neon-blue)" />
                <StatCard icon={UserCheck} label="Paying Users" value={activeSubs} color="var(--neon-blue)" />
                <StatCard icon={DollarSign} label="Total Revenue" value={`₦${totalRevenue.toLocaleString()}`} color="#4ade80" />
                <StatCard icon={TrendingUp} label="Admins" value={admins} color="#a78bfa" />
                <StatCard icon={Activity} label="Posts" value={totalPosts} color="var(--coral)" />
                <StatCard icon={MessageSquare} label="Comments" value={extras.comments} color="var(--coral)" />
                <StatCard icon={Mail} label="Messages" value={extras.messages} color="var(--neon-blue)" />
                <StatCard icon={Ban} label="Suspended" value={suspended} color="var(--coral)" />
            </div>

            <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
                <h3 style={{ fontSize: '1rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <DollarSign size={18} className="gradient-text" /> Revenue (Last 7 days)
                </h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, padding: '8px 0' }}>
                    {days.map((d, i) => (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>₦{d.amount}</div>
                            <div style={{
                                width: '100%', maxWidth: 40,
                                height: `${(d.amount / maxRev) * 100}%`,
                                minHeight: 4,
                                background: 'var(--gradient-brand)',
                                borderRadius: '6px 6px 0 0',
                                transition: 'height 0.3s',
                            }} />
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{d.date}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon: Icon, label, value, color }: any) {
    return (
        <div className="glass-card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: `${color}20`, color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <Icon size={20} />
            </div>
            <div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{value}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
            </div>
        </div>
    );
}
