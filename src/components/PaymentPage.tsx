import React, { useState } from 'react';
import { useSubscription } from '../context/SubscriptionContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { CreditCard, Tag, Sparkles, Shield, Check, X, Receipt, Crown, Zap, Gift, Radio, Video, Monitor } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Payment = {
    id: string;
    amount: number;
    currency: string;
    status: string;
    payment_provider: string;
    paystack_reference: string | null;
    created_at: string;
};

export default function PaymentPage() {
    const { subscription, isActive, isFree, isLive, monthlyPrice, livePrice, startSubscriptionPayment, cancelSubscription, redeemPromoCode, refresh } = useSubscription();
    const { user } = useAuth();
    const { showToast } = useToast();
    const [promoCode, setPromoCode] = useState('');
    const [redeeming, setRedeeming] = useState(false);
    const [payingPremium, setPayingPremium] = useState(false);
    const [payingLive, setPayingLive] = useState(false);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loadingPayments, setLoadingPayments] = useState(true);
    const [now, setNow] = useState(() => Date.now());

    const calcDays = React.useCallback((expiresAt: string) => {
        return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / (1000 * 60 * 60 * 24)));
    }, [now]);

    const daysRemaining = subscription?.expires_at ? calcDays(subscription.expires_at) : 0;

    React.useEffect(() => {
        if (!user) return;
        let cancelled = false;
        (async () => {
            setLoadingPayments(true);
            const { data } = await supabase
                .from('payments')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20);
            if (!cancelled && data) setPayments(data);
            if (!cancelled) setLoadingPayments(false);
        })();
        return () => { cancelled = true; };
    }, [user]);

    React.useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 3600000);
        return () => clearInterval(timer);
    }, []);

    const handleRedeem = async () => {
        if (!promoCode.trim()) return showToast('Please enter a promo code', 'error');
        setRedeeming(true);
        const res = await redeemPromoCode(promoCode);
        setRedeeming(false);
        if (res.ok) {
            setPromoCode('');
            await refresh();
        } else {
            showToast(res.error || 'Failed to redeem code', 'error');
        }
    };

    const refreshPayments = React.useCallback(async () => {
        if (!user) return;
        const { data } = await supabase
            .from('payments')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);
        if (data) setPayments(data);
    }, [user]);

    const handlePay = async () => {
        setPayingPremium(true);
        await startSubscriptionPayment();
        setPayingPremium(false);
        await refreshPayments();
    };

    const handleGoLive = async () => {
        setPayingLive(true);
        await startSubscriptionPayment('live');
        setPayingLive(false);
        await refreshPayments();
    };

    const handleCancel = async () => {
        if (!confirm('Cancel your active subscription? You will lose premium access at the end of the current period.')) return;
        const res = await cancelSubscription();
        if (!res.ok) showToast(res.error || 'Failed to cancel', 'error');
    };



    return (
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '20px 4px' }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '1.5rem' }}>
                    <CreditCard size={26} className="gradient-text" />
                    Premium Subscription
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
                    Unlock the full KSU Connect experience
                </p>
            </div>

            {/* Current plan card */}
            <div className="glass-card" style={{ padding: 24, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            {isLive
                                ? <Radio size={22} color="#a78bfa" />
                                : isActive
                                    ? <Crown size={22} color="var(--neon-blue)" />
                                    : <Zap size={22} color="var(--text-muted)" />}
                            <h2 style={{ fontSize: '1.15rem' }}>
                                {isLive ? 'Live Streamer' : isActive ? 'Premium Active' : 'Free Plan'}
                            </h2>
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            {isLive
                                ? 'You are a verified LIVE streamer! Verified badge ✓ and streaming access.'
                                : isActive
                                    ? `Your premium access is active. Renews on ${subscription?.expires_at ? new Date(subscription.expires_at).toLocaleDateString() : 'N/A'}.`
                                    : 'You are on the free plan. Upgrade to access all features.'}
                        </p>
                    </div>
                    {isActive && !isLive && (
                        <div style={{
                            padding: '6px 14px', borderRadius: 999,
                            background: 'rgba(76, 201, 240, 0.15)', color: 'var(--neon-blue)',
                            fontWeight: 700, fontSize: '0.85rem',
                            border: '1px solid rgba(76, 201, 240, 0.3)',
                        }}>
                            {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
                        </div>
                    )}
                    {isLive && (
                        <div style={{
                            padding: '6px 14px', borderRadius: 999,
                            background: 'rgba(167, 139, 250, 0.15)', color: '#a78bfa',
                            fontWeight: 700, fontSize: '0.85rem',
                            border: '1px solid rgba(167, 139, 250, 0.3)',
                            display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                            <Radio size={14} />
                            <span>LIVE STREAMER</span>
                        </div>
                    )}
                </div>

                {isActive && subscription?.payment_provider === 'promo_code' && (
                    <div style={{
                        marginTop: 16, padding: 12, borderRadius: 10,
                        background: 'rgba(167, 139, 250, 0.1)', border: '1px solid rgba(167, 139, 250, 0.25)',
                        fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                        <Gift size={16} color="var(--neon-purple, #a78bfa)" />
                        <span>Activated via promo code <strong>{subscription.payment_reference?.replace('PROMO-', '')}</strong></span>
                    </div>
                )}

                {isActive && subscription?.payment_provider === 'monnify' && (

                    <div style={{ marginTop: 16 }}>
                        <button className="btn btn-secondary btn-sm" onClick={handleCancel}>
                            Cancel Subscription
                        </button>
                    </div>
                )}
            </div>

            {/* Plans */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
                {/* Free plan */}
                <div className="glass-card" style={{ padding: 22, opacity: isFree ? 0.6 : 1 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Free</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, margin: '8px 0 2px' }}>₦0</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>Forever free</div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                            <Check size={14} color="var(--neon-blue)" /> Create account
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                            <Check size={14} color="var(--neon-blue)" /> Read public posts
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                            <Check size={14} color="var(--neon-blue)" /> Watch live streams
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                            <Check size={14} color="var(--neon-blue)" /> Basic profile
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            <X size={14} /> Post & interact
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            <X size={14} /> Go live / stream
                        </li>
                    </ul>
                </div>

                {/* Premium plan */}
                <div className="glass-card" style={{
                    padding: 22, position: 'relative', overflow: 'hidden',
                    border: '1px solid rgba(76, 201, 240, 0.4)',
                    boxShadow: '0 0 32px rgba(76, 201, 240, 0.15)',
                }}>
                    <div style={{
                        position: 'absolute', top: 12, right: -28, transform: 'rotate(35deg)',
                        background: 'var(--gradient-brand)', color: 'white', fontSize: '0.65rem',
                        fontWeight: 800, padding: '4px 32px', letterSpacing: 1,
                    }}>POPULAR</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--neon-blue)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Premium</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '8px 0 2px' }}>
                        <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>₦{monthlyPrice}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/month</div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>Billed monthly</div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                        <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                            <Check size={14} color="var(--neon-blue)" /> Everything in Free
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                            <Check size={14} color="var(--neon-blue)" /> Create & share posts
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                            <Check size={14} color="var(--neon-blue)" /> Like & comment
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                            <Check size={14} color="var(--neon-blue)" /> Send messages
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                            <Check size={14} color="var(--neon-blue)" /> Watch live streams
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                            <Check size={14} color="var(--neon-blue)" /> Verified badge eligible
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                            <Check size={14} color="var(--neon-blue)" /> Priority support
                        </li>
                    </ul>
                    {!isActive && (
                        <button className="btn btn-primary w-full" onClick={handlePay} disabled={payingPremium}>
                            {payingPremium
                                ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                                : <><Sparkles size={16} /> Subscribe for ₦{monthlyPrice}</>}
                        </button>
                    )}
                    {isActive && (
                        <div style={{ textAlign: 'center', padding: 10, background: 'rgba(76, 201, 240, 0.1)', borderRadius: 8, color: 'var(--neon-blue)', fontSize: '0.85rem', fontWeight: 600 }}>
                            ✓ Active
                        </div>
                    )}
                </div>

                {/* Go Live plan - now monthly with streaming */}
                <div className="glass-card" style={{
                    padding: 22, position: 'relative', overflow: 'hidden',
                    border: '1px solid rgba(167, 139, 250, 0.5)',
                    boxShadow: '0 0 32px rgba(167, 139, 250, 0.2)',
                }}>
                    <div style={{
                        position: 'absolute', top: 12, right: -28, transform: 'rotate(35deg)',
                        background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', color: 'white', fontSize: '0.65rem',
                        fontWeight: 800, padding: '4px 32px', letterSpacing: 1,
                    }}>BEST VALUE</div>
                    <div style={{ fontSize: '0.75rem', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Live Streamer</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '8px 0 2px' }}>
                        <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>₦{livePrice}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/month</div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>Billed monthly • Cancel anytime</div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                        <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                            <Check size={14} color="#a78bfa" /> Everything in Premium
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                            <Check size={14} color="#a78bfa" /> <strong>Go live & stream</strong> to all followers
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                            <Check size={14} color="#a78bfa" /> Live video broadcasting
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                            <Check size={14} color="#a78bfa" /> Verified badge ✓ on profile
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                            <Check size={14} color="#a78bfa" /> Priority visibility in feeds
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                            <Check size={14} color="#a78bfa" /> Early access to new features
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                            <Check size={14} color="#a78bfa" /> Premium support
                        </li>
                    </ul>
                    {!isLive && (
                        <button className="btn" style={{
                            width: '100%',
                            background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
                            color: 'white',
                            fontWeight: 700,
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: 'var(--border-radius-md)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            opacity: payingLive ? 0.7 : 1,
                        }} onClick={handleGoLive} disabled={payingLive}>
                            {payingLive
                                ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                                : <><Radio size={16} /> Go Live – ₦{livePrice}/month</>}
                        </button>
                    )}
                    {(isLive || (isActive && subscription?.plan === 'live')) && (
                        <div style={{ textAlign: 'center', padding: 10, background: 'rgba(167, 139, 250, 0.15)', borderRadius: 8, color: '#a78bfa', fontSize: '0.85rem', fontWeight: 600, border: '1px solid rgba(167, 139, 250, 0.3)' }}>
                            ✓ You're LIVE – Verified badge active
                        </div>
                    )}
                </div>
            </div>

            {/* Promo code */}
            <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Tag size={18} className="gradient-text" />
                    <h3 style={{ fontSize: '1rem' }}>Have a promo code?</h3>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 12 }}>
                    Redeem a code to get free premium access for 30 days.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input
                        className="input"
                        placeholder="Enter promo code"
                        value={promoCode}
                        onChange={e => setPromoCode(e.target.value.toUpperCase())}
                        onKeyDown={e => { if (e.key === 'Enter') handleRedeem(); }}
                        style={{ flex: 1, textTransform: 'uppercase', letterSpacing: 1 }}
                    />
                    <button className="btn btn-primary" onClick={handleRedeem} disabled={redeeming}>
                        {redeeming
                            ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                            : 'Redeem'}
                    </button>
                </div>
            </div>

            {/* Trust badges */}
            <div className="glass-card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Shield size={14} /> Secure payments via Monnify</span>

                <span>•</span>
                <span>Cancel anytime</span>
                <span>•</span>
                <span>30-day promo codes available</span>
            </div>

            {/* Payment history */}
            <div className="glass-card" style={{ padding: 20, marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <Receipt size={18} className="gradient-text" />
                    <h3 style={{ fontSize: '1rem' }}>Payment History</h3>
                </div>
                {loadingPayments ? (
                    <div style={{ textAlign: 'center', padding: 30 }}><div className="spinner" /></div>
                ) : payments.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20, fontSize: '0.9rem' }}>
                        No payment history yet.
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {payments.map(p => (
                            <div key={p.id} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: 12, background: 'var(--glass-bg)', borderRadius: 10,
                                border: '1px solid var(--glass-border)',
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                                        ₦{p.amount} {p.currency}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {new Date(p.created_at).toLocaleString()} • {p.payment_provider}
                                    </div>
                                    {p.paystack_reference && (
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                            Ref: {p.paystack_reference}
                                        </div>
                                    )}
                                </div>
                                <div style={{
                                    padding: '4px 10px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                                    background: p.status === 'success' ? 'rgba(76, 201, 240, 0.15)' :
                                        p.status === 'failed' ? 'rgba(255, 107, 107, 0.15)' :
                                            p.status === 'refunded' ? 'rgba(255, 193, 7, 0.15)' :
                                                'rgba(255, 255, 255, 0.1)',
                                    color: p.status === 'success' ? 'var(--neon-blue)' :
                                        p.status === 'failed' ? 'var(--coral)' :
                                            p.status === 'refunded' ? '#ffc107' : 'var(--text-muted)',
                                }}>
                                    {p.status}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Live streaming info */}
            <div className="glass-card" style={{ padding: 16, marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <Video size={20} className="gradient-text" />
                <div>
                    <strong style={{ color: 'var(--text-primary)' }}>Live Streaming</strong>
                    <p style={{ marginTop: 4 }}>Go Live streamers can broadcast video to all followers in real-time. Start a stream from your profile or the feed.</p>
                </div>
            </div>
        </div>
    );
}