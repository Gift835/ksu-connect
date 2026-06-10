import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { openMonnifyCheckout, generateReference } from '../lib/monnify';
import { useToast } from './ToastContext';

export type Subscription = {
    id: string;
    user_id: string;
    status: 'free' | 'active' | 'expired' | 'cancelled' | 'suspended';
    plan: 'free' | 'monthly' | 'live';
    amount_paid: number;
    currency: string;
    payment_provider: string | null;
    payment_reference: string | null;
    starts_at: string | null;
    expires_at: string | null;
    activated_by_promo_id: string | null;
    created_at: string;
    updated_at: string;
};

const MONTHLY_PRICE_NAIRA = 300;
const LIVE_PRICE_NAIRA = 500; // now also monthly

interface SubContextType {
    subscription: Subscription | null;
    loading: boolean;
    isActive: boolean;
    isFree: boolean;
    isLive: boolean;
    monthlyPrice: number;
    livePrice: number;
    refresh: () => Promise<void>;
    redeemPromoCode: (code: string) => Promise<{ ok: boolean; error?: string }>;
    startSubscriptionPayment: (plan?: 'monthly' | 'live') => Promise<{ ok: boolean; error?: string }>;
    cancelSubscription: () => Promise<{ ok: boolean; error?: string }>;
}

const SubscriptionContext = createContext<SubContextType | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchSubscription = useCallback(async () => {
        if (!user) {
            setSubscription(null);
            setLoading(false);
            return;
        }
        const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) {
            console.error('Sub fetch error', error);
        }
        if (data && data.status === 'active' && data.expires_at && new Date(data.expires_at) < new Date()) {
            await supabase.from('subscriptions').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', data.id);
            setSubscription({ ...data, status: 'expired' });
        } else {
            setSubscription(data as Subscription | null);
        }
        setLoading(false);
    }, [user]);

    useEffect(() => {
        fetchSubscription();
        if (!user) return;
        const sub = supabase
            .channel('sub_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions', filter: `user_id=eq.${user.id}` }, () => fetchSubscription())
            .subscribe();
        return () => {
            supabase.removeChannel(sub);
        };
    }, [user, fetchSubscription]);

    const isActive = subscription?.status === 'active' && (
        !subscription?.expires_at ||
        new Date(subscription.expires_at) > new Date()
    );
    const isFree = !isActive;
    const isLive = subscription?.plan === 'live' && subscription?.status === 'active';

    const redeemPromoCode = async (code: string): Promise<{ ok: boolean; error?: string }> => {
        if (!user) return { ok: false, error: 'Not logged in' };
        const trimmed = code.trim().toUpperCase();
        if (!trimmed) return { ok: false, error: 'Please enter a promo code' };

        const { data: promo, error: pErr } = await supabase
            .from('promo_codes')
            .select('*')
            .eq('code', trimmed)
            .maybeSingle();
        if (pErr) return { ok: false, error: pErr.message };
        if (!promo) return { ok: false, error: 'Invalid promo code' };
        if (!promo.is_active) return { ok: false, error: 'This promo code is no longer active' };
        if (promo.expires_at && new Date(promo.expires_at) < new Date()) return { ok: false, error: 'This promo code has expired' };
        if (promo.times_used >= promo.max_uses) return { ok: false, error: 'This promo code has been fully used' };

        const { data: existing } = await supabase
            .from('promo_redemptions')
            .select('id')
            .eq('user_id', user.id)
            .eq('promo_code_id', promo.id)
            .maybeSingle();
        if (existing) return { ok: false, error: 'You have already used this promo code' };

        const { error: rErr } = await supabase.from('promo_redemptions').insert({
            user_id: user.id,
            promo_code_id: promo.id,
        });
        if (rErr) return { ok: false, error: rErr.message };

        await supabase.from('promo_codes').update({ times_used: promo.times_used + 1 }).eq('id', promo.id);

        const now = new Date();
        const expires = new Date();
        expires.setDate(expires.getDate() + 30);

        await supabase.from('subscriptions').update({ status: 'cancelled', updated_at: now.toISOString() }).eq('user_id', user.id).eq('status', 'active');

        const { error: sErr } = await supabase.from('subscriptions').insert({
            user_id: user.id,
            status: 'active',
            plan: 'monthly',
            amount_paid: 0,
            currency: 'NGN',
            payment_provider: 'promo_code',
            payment_reference: `PROMO-${promo.code}`,
            starts_at: now.toISOString(),
            expires_at: expires.toISOString(),
            activated_by_promo_id: promo.id,
        });
        if (sErr) return { ok: false, error: sErr.message };

        await supabase.from('admin_actions').insert({
            admin_id: user.id,
            action_type: 'promo_redeem',
            target_user_id: user.id,
            details: { promo_code: promo.code },
        }).then(() => { });

        await fetchSubscription();
        showToast(`🎉 Promo code applied! You're premium for 30 days.`, 'success');
        return { ok: true };
    };

    const startSubscriptionPayment = async (plan: 'monthly' | 'live' = 'monthly'): Promise<{ ok: boolean; error?: string }> => {
        if (!user) return { ok: false, error: 'Not logged in' };

        const isLive = plan === 'live';
        const amountNaira = isLive ? LIVE_PRICE_NAIRA : MONTHLY_PRICE_NAIRA;
        const amountKobo = amountNaira * 100;
        const reference = generateReference('ksu_sub');

        const { data: payment, error: pErr } = await supabase.from('payments').insert({
            user_id: user.id,
            amount: amountNaira,
            currency: 'NGN',
            status: 'pending',
            payment_provider: 'monnify',
            paystack_reference: reference,
            metadata: { plan, type: 'monthly_subscription' },
        }).select().single();
        if (pErr) return { ok: false, error: pErr.message };

        return new Promise((resolve) => {
            openMonnifyCheckout({
                amount: amountKobo,
                customerName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Customer',
                customerEmail: user.email || '',
                paymentReference: reference,
                paymentDescription: isLive
                    ? 'KSU Connect - Live Streamer Monthly'
                    : 'KSU Connect Monthly Premium Subscription',
                metadata: {
                    user_id: user.id,
                    payment_id: payment.id,
                    plan,
                },
                onSuccess: async (response) => {
                    const now = new Date();

                    await supabase.from('payments').update({
                        status: 'success',
                        paystack_paid_at: now.toISOString(),
                        paystack_channel: response.channel,
                    }).eq('paystack_reference', response.paymentReference);

                    // Cancel old active subs
                    await supabase.from('subscriptions').update({ status: 'cancelled', updated_at: now.toISOString() }).eq('user_id', user.id).eq('status', 'active');

                    // Both plans now have 30-day expiry (monthly)
                    const expires_at = new Date(now);
                    expires_at.setDate(expires_at.getDate() + 30);

                    const { data: sub } = await supabase.from('subscriptions').insert({
                        user_id: user.id,
                        status: 'active',
                        plan: plan,
                        amount_paid: amountNaira,
                        currency: 'NGN',
                        payment_provider: 'monnify',
                        payment_reference: response.paymentReference,
                        starts_at: now.toISOString(),
                        expires_at: expires_at.toISOString(),
                    }).select().single();

                    if (sub) {
                        await supabase.from('payments').update({ subscription_id: sub.id }).eq('id', payment.id);
                    }

                    // For Go Live: also mark profile as verified so they get the badge
                    if (isLive) {
                        await supabase.from('profiles').update({ is_verified: true }).eq('id', user.id);
                        await supabase.auth.updateUser({ data: { is_live: true } });
                    }

                    await fetchSubscription();
                    if (isLive) {
                        showToast(`🎉 You're now LIVE! Verified badge activated. Your subscription renews monthly.`, 'success');
                    } else {
                        showToast(`🎉 Payment successful! You're premium until ${expires_at.toLocaleDateString()}.`, 'success');
                    }
                    resolve({ ok: true });
                },
                onClose: async () => {
                    await supabase.from('payments').update({ status: 'failed' }).eq('paystack_reference', reference);
                    showToast('Payment cancelled', 'info');
                    resolve({ ok: false, error: 'Payment cancelled' });
                },
            });
        });
    };

    const cancelSubscription = async (): Promise<{ ok: boolean; error?: string }> => {
        if (!user || !subscription) return { ok: false, error: 'No active subscription' };
        const { error } = await supabase.from('subscriptions').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', subscription.id);
        if (error) return { ok: false, error: error.message };
        await fetchSubscription();
        showToast('Subscription cancelled', 'info');
        return { ok: true };
    };

    return (
        <SubscriptionContext.Provider value={{
            subscription,
            loading,
            isActive,
            isFree,
            isLive,
            monthlyPrice: MONTHLY_PRICE_NAIRA,
            livePrice: LIVE_PRICE_NAIRA,
            refresh: fetchSubscription,
            redeemPromoCode,
            startSubscriptionPayment,
            cancelSubscription,
        }}>
            {children}
        </SubscriptionContext.Provider>
    );
}

export const useSubscription = () => {
    const ctx = useContext(SubscriptionContext);
    if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
    return ctx;
};