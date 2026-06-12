import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import {
    Settings as SettingsIcon, Moon, Sun, Bell, Lock, Eye, Globe, Type, Palette,
    ChevronRight, ChevronLeft, Shield, Trash2, Download, Mail, MessageSquare,
    Heart, UserCheck, AtSign, PlayCircle, AlertCircle, Languages, Smartphone,
    Volume2, HelpCircle, FileText, LogOut, RotateCcw, MessageCircle
} from 'lucide-react';


type Section = 'main' | 'appearance' | 'notifications' | 'privacy' | 'content' | 'account' | 'about' | 'policy';

export default function SettingsPage() {
    const { user, profile, signOut, refreshProfile } = useAuth();
    const { settings, update, updateNested, reset } = useSettings();
    const { showToast } = useToast();
    const [section, setSection] = useState<Section>('main');

    const isDark = settings.theme === 'dark';

    const handleClearCache = () => {
        if (confirm('Clear all locally stored app data? You will stay logged in.')) {
            const keep = ['ksu_settings'];
            const all = Object.keys(localStorage);
            all.forEach(k => { if (!keep.includes(k)) localStorage.removeItem(k); });
            showToast('Local cache cleared', 'success');
            setTimeout(() => window.location.reload(), 500);
        }
    };

    const handleDeleteAccount = async () => {
        const confirm1 = prompt('This will PERMANENTLY delete your account and all your posts/comments. Type "DELETE" to confirm:');
        if (confirm1 !== 'DELETE') return;
        const { error } = await supabase.from('profiles').delete().eq('id', user!.id);
        if (error) { showToast(error.message, 'error'); return; }
        await supabase.auth.signOut();
        showToast('Account deleted', 'success');
        window.location.href = '/';
    };

    const renderMain = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SectionItem
                icon={isDark ? Moon : Sun}
                title="Appearance"
                subtitle={isDark ? 'Dark mode' : 'Light mode'}
                onClick={() => setSection('appearance')}
            />
            <SectionItem
                icon={Bell}
                title="Notifications"
                subtitle="Push, email, in-app"
                onClick={() => setSection('notifications')}
            />
            <SectionItem
                icon={Lock}
                title="Privacy"
                subtitle="Account, mentions, messages"
                onClick={() => setSection('privacy')}
            />
            <SectionItem
                icon={Eye}
                title="Content & Display"
                subtitle="Videos, language, filters"
                onClick={() => setSection('content')}
            />
            <SectionItem
                icon={Shield}
                title="Account"
                subtitle="Email, password, delete"
                onClick={() => setSection('account')}
            />
            <SectionItem
                icon={FileText}
                title="Community Policy"
                subtitle="Rules, guidelines & what's not allowed"
                onClick={() => setSection('policy')}
            />
            <SectionItem
                icon={HelpCircle}
                title="About & Help"
                subtitle="Version, terms, support"
                onClick={() => setSection('about')}
            />

            <div style={{ height: 1, background: 'var(--glass-border)', margin: '12px 0' }} />

            <button
                onClick={() => { if (confirm('Reset all settings to defaults?')) { reset(); showToast('Settings reset', 'success'); } }}
                className="glass-card"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, width: '100%', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--glass-border)' }}
            >
                <RotateCcw size={18} color="var(--text-muted)" />
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Reset settings</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Restore all defaults</div>
                </div>
            </button>

            <button
                onClick={() => { if (confirm('Sign out of KSU Connect?')) signOut(); }}
                className="glass-card"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, width: '100%', textAlign: 'left', cursor: 'pointer', border: '1px solid rgba(255,107,107,0.2)' }}
            >
                <LogOut size={18} color="var(--coral)" />
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--coral)' }}>Sign out</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.email}</div>
                </div>
            </button>
        </div>
    );

    const renderAppearance = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <BackHeader title="Appearance" onBack={() => setSection('main')} />

            <SettingGroup title="Theme">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <ThemeOption
                        active={isDark}
                        onClick={() => update('theme', 'dark')}
                        icon={Moon}
                        label="Dark"
                        preview="dark"
                    />
                    <ThemeOption
                        active={!isDark}
                        onClick={() => update('theme', 'light')}
                        icon={Sun}
                        label="Light"
                        preview="light"
                    />
                </div>
            </SettingGroup>

            <SettingGroup title="Font size">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {(['small', 'medium', 'large'] as const).map(size => (
                        <button
                            key={size}
                            onClick={() => update('fontSize', size)}
                            className="btn"
                            style={{
                                background: settings.fontSize === size ? 'var(--gradient-brand)' : 'var(--bg-input)',
                                color: settings.fontSize === size ? 'white' : 'var(--text-primary)',
                                border: settings.fontSize === size ? 'none' : '1px solid var(--glass-border)',
                                textTransform: 'capitalize',
                            }}
                        >
                            <span style={{ fontSize: size === 'small' ? '0.75rem' : size === 'large' ? '1.1rem' : '0.9rem' }}>
                                Aa
                            </span> {size}
                        </button>
                    ))}
                </div>
            </SettingGroup>

            <SettingGroup title="Accent color">
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {['#ff6b6b', '#4ecdc4', '#a855f7', '#f59e0b', '#ec4899', '#10b981'].map(c => (
                        <button
                            key={c}
                            style={{
                                width: 36, height: 36, borderRadius: '50%',
                                background: c, border: '3px solid var(--bg-primary)',
                                boxShadow: '0 0 0 1px var(--glass-border)',
                                cursor: 'pointer',
                            }}
                            onClick={() => {
                                document.documentElement.style.setProperty('--coral', c);
                                showToast('Accent color updated! Reload to see globally.', 'info');
                            }}
                        />
                    ))}
                </div>
            </SettingGroup>
        </div>
    );

    const renderNotifications = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <BackHeader title="Notifications" onBack={() => setSection('main')} />

            <SettingGroup title="Delivery">
                <ToggleRow
                    icon={Smartphone}
                    title="Push notifications"
                    subtitle="Alerts on your device"
                    value={settings.notifications.push}
                    onChange={v => updateNested('notifications', ['push'], v)}
                />
                <ToggleRow
                    icon={Mail}
                    title="Email notifications"
                    subtitle="Daily/weekly digests"
                    value={settings.notifications.email}
                    onChange={v => updateNested('notifications', ['email'], v)}
                />
            </SettingGroup>

            <SettingGroup title="Activity">
                <ToggleRow
                    icon={Heart}
                    title="Likes"
                    subtitle="When someone likes your post"
                    value={settings.notifications.likes}
                    onChange={v => updateNested('notifications', ['likes'], v)}
                />
                <ToggleRow
                    icon={MessageSquare}
                    title="Comments"
                    subtitle="Replies and mentions"
                    value={settings.notifications.comments}
                    onChange={v => updateNested('notifications', ['comments'], v)}
                />
                <ToggleRow
                    icon={UserCheck}
                    title="Follows"
                    subtitle="New followers"
                    value={settings.notifications.follows}
                    onChange={v => updateNested('notifications', ['follows'], v)}
                />
                <ToggleRow
                    icon={MessageCircle}
                    title="Messages"
                    subtitle="New direct messages"
                    value={settings.notifications.messages}
                    onChange={v => updateNested('notifications', ['messages'], v)}
                />
            </SettingGroup>

            <SettingGroup title="Other">
                <ToggleRow
                    icon={Volume2}
                    title="Marketing emails"
                    subtitle="Tips, offers, and product news"
                    value={settings.notifications.marketing}
                    onChange={v => updateNested('notifications', ['marketing'], v)}
                />
            </SettingGroup>
        </div>
    );

    const renderPrivacy = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <BackHeader title="Privacy" onBack={() => setSection('main')} />

            <SettingGroup title="Account">
                <ToggleRow
                    icon={Lock}
                    title="Private account"
                    subtitle="Only approved followers can see your posts"
                    value={settings.privacy.privateAccount}
                    onChange={async v => {
                        updateNested('privacy', ['privateAccount'], v);
                        await supabase.from('profiles').update({ is_private: v }).eq('id', user!.id);
                        await refreshProfile();
                    }}
                />
                <ToggleRow
                    icon={Eye}
                    title="Activity status"
                    subtitle="Show when you're online"
                    value={settings.privacy.showActivity}
                    onChange={v => updateNested('privacy', ['showActivity'], v)}
                />
            </SettingGroup>

            <SettingGroup title="Interactions">
                <SelectRow
                    icon={AtSign}
                    title="Who can @mention you"
                    value={settings.privacy.allowMentions}
                    onChange={v => updateNested('privacy', ['allowMentions'], v)}
                    options={[
                        { value: 'everyone', label: 'Everyone' },
                        { value: 'followers', label: 'People you follow' },
                        { value: 'none', label: 'No one' },
                    ]}
                />
                <SelectRow
                    icon={MessageCircle}
                    title="Who can message you"
                    value={settings.privacy.allowMessages}
                    onChange={v => updateNested('privacy', ['allowMessages'], v)}
                    options={[
                        { value: 'everyone', label: 'Everyone' },
                        { value: 'followers', label: 'People you follow' },
                        { value: 'none', label: 'No one' },
                    ]}
                />
            </SettingGroup>
        </div>
    );

    const renderContent = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <BackHeader title="Content & Display" onBack={() => setSection('main')} />

            <SettingGroup title="Videos">
                <ToggleRow
                    icon={PlayCircle}
                    title="Autoplay videos"
                    subtitle="Videos play automatically in feed"
                    value={settings.content.autoplayVideos}
                    onChange={v => updateNested('content', ['autoplayVideos'], v)}
                />
            </SettingGroup>

            <SettingGroup title="Filters">
                <ToggleRow
                    icon={AlertCircle}
                    title="Hide sensitive content"
                    subtitle="Filter content that may be upsetting"
                    value={settings.content.sensitiveContent}
                    onChange={v => updateNested('content', ['sensitiveContent'], v)}
                />
                <ToggleRow
                    icon={Languages}
                    title="Language filter"
                    subtitle="Hide posts in other languages"
                    value={settings.content.languageFilter}
                    onChange={v => updateNested('content', ['languageFilter'], v)}
                />
            </SettingGroup>

            <SettingGroup title="Language">
                <SelectRow
                    icon={Globe}
                    title="App language"
                    value={settings.language}
                    onChange={v => update('language', v)}
                    options={[
                        { value: 'en', label: '🇬🇧 English' },
                        { value: 'pcm', label: '🇳🇬 Nigerian Pidgin' },
                        { value: 'yo', label: '🇳🇬 Yorùbá' },
                        { value: 'ig', label: '🇳🇬 Igbo' },
                        { value: 'ha', label: '🇳🇬 Hausa' },
                        { value: 'fr', label: '🇫🇷 Français (French)' },
                        { value: 'ar', label: '🇸🇦 العربية (Arabic)' },
                        { value: 'es', label: '🇪🇸 Español (Spanish)' },
                        { value: 'pt', label: '🇧🇷 Português (Portuguese)' },
                        { value: 'sw', label: '🇰🇪 Kiswahili (Swahili)' },
                        { value: 'zh', label: '🇨🇳 中文 (Chinese)' },
                        { value: 'de', label: '🇩🇪 Deutsch (German)' },
                        { value: 'it', label: '🇮🇹 Italiano (Italian)' },
                        { value: 'ja', label: '🇯🇵 日本語 (Japanese)' },
                        { value: 'ko', label: '🇰🇷 한국어 (Korean)' },
                        { value: 'ru', label: '🇷🇺 Русский (Russian)' },
                    ]}
                />
            </SettingGroup>
        </div>
    );

    const renderAccount = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <BackHeader title="Account" onBack={() => setSection('main')} />

            <SettingGroup title="Profile info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                    {profile?.avatar_url ? (
                        <img src={profile.avatar_url} className="avatar avatar-md" alt="me" />
                    ) : (
                        <div className="avatar-placeholder avatar-md">
                            {profile?.username?.[0]?.toUpperCase()}
                        </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700 }}>{profile?.full_name || profile?.username}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@{profile?.username}</div>
                    </div>
                </div>
                <RowItem icon={UserCheck} title="Edit profile" subtitle="Name, bio, avatar" onClick={() => showToast('Open your profile to edit it', 'info')} />
            </SettingGroup>

            <SettingGroup title="Login & Security">
                <RowItem icon={Mail} title="Email" subtitle={user?.email} onClick={() => showToast('Contact support to change email', 'info')} />
                <RowItem
                    icon={Lock}
                    title="Change password"
                    subtitle="Last changed: never"
                    onClick={async () => {
                        const { error } = await supabase.auth.resetPasswordForEmail(user?.email || '', {
                            redirectTo: window.location.origin,
                        });
                        if (error) showToast(error.message, 'error');
                        else showToast('Password reset email sent!', 'success');
                    }}
                />
            </SettingGroup>

            <SettingGroup title="Data">
                <RowItem icon={Download} title="Download my data" subtitle="Get a copy of your info" onClick={() => showToast('Coming soon', 'info')} />
                <RowItem icon={Trash2} title="Clear local cache" subtitle="Free up storage" onClick={handleClearCache} danger />
            </SettingGroup>

            <SettingGroup title="Danger zone">
                <RowItem
                    icon={Trash2}
                    title="Delete account"
                    subtitle="Permanently delete your account and data"
                    onClick={handleDeleteAccount}
                    danger
                />
            </SettingGroup>
        </div>
    );

    const renderAbout = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <BackHeader title="About & Help" onBack={() => setSection('main')} />

            <div className="glass-card" style={{ padding: 24, textAlign: 'center' }}>
                <div style={{
                    width: 64, height: 64, borderRadius: 18, margin: '0 auto 12px',
                    background: 'var(--gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <SettingsIcon size={28} color="white" />
                </div>
                <h2 className="gradient-text" style={{ fontSize: '1.3rem' }}>KSU Connect</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>Version 1.0.0</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: 8 }}>
                    The social hub for KSU students & community
                </p>
            </div>

            <SettingGroup>
                <RowItem icon={FileText} title="Terms of Service" onClick={() => showToast('Visit ksuconnect.app/terms', 'info')} />
                <RowItem icon={Shield} title="Privacy Policy" onClick={() => showToast('Visit ksuconnect.app/privacy', 'info')} />
                <RowItem icon={FileText} title="Community Guidelines" subtitle="What's allowed and what's not" onClick={() => setSection('policy')} />
                <RowItem icon={HelpCircle} title="Help Center" onClick={() => showToast('Email: support@ksuconnect.app', 'info')} />
                <RowItem icon={Mail} title="Contact us" subtitle="support@ksuconnect.app" onClick={() => showToast('support@ksuconnect.app', 'info')} />
            </SettingGroup>

            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', padding: 16 }}>
                Made with ❤️ for KSU students
            </p>
        </div>
    );

    const renderPolicy = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <BackHeader title="Community Policy" onBack={() => setSection('main')} />

            <div className="glass-card" style={{ padding: 20, background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(139,92,246,0.08))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #ef4444, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Shield size={20} color="white" />
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>KSU Connect Community Guidelines</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Effective: June 2026 · Version 1.0</div>
                    </div>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    KSU Connect is a safe and respectful campus community. By using this platform, you agree to follow these guidelines.
                    Violations may result in post removal, account suspension, or permanent ban.
                </p>
            </div>

            {([
                {
                    title: '🚫 No Hate Speech or Discrimination',
                    body: 'Content that promotes hatred, discrimination, or violence against any individual or group based on race, ethnicity, religion, gender, sexual orientation, disability, or nationality is strictly prohibited. This includes slurs, dehumanizing language, and discriminatory imagery.'
                },
                {
                    title: '🔞 No Sexual or Explicit Content',
                    body: 'Posting, sharing, or requesting sexually explicit content, nudity, or sexual solicitation of any kind is not allowed. This is a campus platform accessible to students of all ages. Any such content will be immediately removed and the account suspended.'
                },
                {
                    title: '🛡️ No Harassment or Bullying',
                    body: 'Do not target, threaten, intimidate, or bully other users. This includes repeated unwanted messages, sharing private information (doxxing), and coordinated attacks on individuals. Respectful disagreement is fine — personal attacks are not.'
                },
                {
                    title: '🎭 No Impersonation or Fake Accounts',
                    body: 'Do not create accounts pretending to be another person, student, lecturer, or organization. Using misleading profile photos, names, or descriptions to deceive others is a violation and may lead to immediate permanent ban.'
                },
                {
                    title: '📢 No Spam or Misleading Content',
                    body: 'Posting repetitive content, unsolicited promotions, chain messages, misleading clickbait, or coordinated inauthentic behavior (fake engagement) is not allowed. Posts must be genuine and add value to the community.'
                },
                {
                    title: '🔒 Respect Privacy',
                    body: 'Never share someone else\'s private information without their consent — this includes phone numbers, home addresses, personal photos, financial details, or private conversations. Always get consent before tagging people or sharing their content.'
                },
                {
                    title: '⚠️ No Dangerous or Illegal Content',
                    body: 'Content that promotes or facilitates illegal activities including drug use, weapon possession, academic fraud/exam malpractice, piracy, or any criminal activity is strictly forbidden on this platform.'
                },
                {
                    title: '📚 Academic Integrity',
                    body: 'KSU Connect does not condone academic dishonesty. Do not use this platform to request, share, or sell exam questions, answer sheets, or to coordinate cheating. Such actions violate both these guidelines and university policy.'
                },
                {
                    title: '🎥 Live Stream Rules',
                    body: 'Live streams must comply with all community guidelines. You may not stream adult content, hate speech, dangerous activities, or content that violates anyone\'s privacy. Hosts are responsible for the content of their streams at all times.'
                },
                {
                    title: '✅ How to Report Violations',
                    body: 'If you see content that violates these guidelines, use the report button on the post or profile. Our moderation team reviews all reports. You can also email: support@ksuconnect.app. We take all reports seriously and respond within 24 hours.'
                },
            ] as { title: string; body: string }[]).map((item, i) => (
                <div key={i} className="glass-card" style={{ padding: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: 6 }}>{item.title}</div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.65, margin: 0 }}>{item.body}</p>
                </div>
            ))}

            <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                By continuing to use KSU Connect, you agree to abide by these Community Guidelines.
                <br />For questions: <span style={{ color: 'var(--text-accent)' }}>support@ksuconnect.app</span>
            </div>
        </div>
    );

    return (
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 4px' }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '1.5rem' }}>
                    <SettingsIcon size={26} className="gradient-text" />
                    Settings
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 4 }}>
                    Manage your account, appearance & privacy
                </p>
            </div>

            {section === 'main' && renderMain()}
            {section === 'appearance' && renderAppearance()}
            {section === 'notifications' && renderNotifications()}
            {section === 'privacy' && renderPrivacy()}
            {section === 'content' && renderContent()}
            {section === 'account' && renderAccount()}
            {section === 'policy' && renderPolicy()}
            {section === 'about' && renderAbout()}
        </div>
    );
}

/* ============================================================ */
function SectionItem({ icon: Icon, title, subtitle, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className="glass-card"
            style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: 14,
                width: '100%', textAlign: 'left', cursor: 'pointer',
                border: '1px solid var(--glass-border)',
            }}
        >
            <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'var(--gradient-brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', flexShrink: 0,
            }}>
                <Icon size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{title}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{subtitle}</div>
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
        </button>
    );
}

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={onBack} className="btn btn-icon" style={{ width: 36, height: 36 }}>
                <ChevronLeft size={18} />
            </button>
            <h2 style={{ fontSize: '1.15rem' }}>{title}</h2>
        </div>
    );
}

function SettingGroup({ title, children }: { title?: string; children: React.ReactNode }) {
    return (
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            {title && (
                <div style={{
                    padding: '12px 16px 8px',
                    fontSize: '0.7rem', fontWeight: 700,
                    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1,
                }}>
                    {title}
                </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {children}
            </div>
        </div>
    );
}

function ToggleRow({ icon: Icon, title, subtitle, value, onChange }: any) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px', borderTop: '1px solid var(--glass-border)',
        }}>
            <Icon size={18} color="var(--text-secondary)" />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{title}</div>
                {subtitle && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{subtitle}</div>}
            </div>
            <button
                onClick={() => onChange(!value)}
                style={{
                    width: 44, height: 24, borderRadius: 999,
                    background: value ? 'var(--gradient-brand)' : 'rgba(255,255,255,0.15)',
                    border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                    flexShrink: 0,
                }}
            >
                <span style={{
                    position: 'absolute', top: 2, left: value ? 22 : 2,
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'white', transition: 'left 0.2s', display: 'block',
                }} />
            </button>
        </div>
    );
}

function SelectRow({ icon: Icon, title, value, onChange, options }: any) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px', borderTop: '1px solid var(--glass-border)',
        }}>
            <Icon size={18} color="var(--text-secondary)" />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{title}</div>
            </div>
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 8, padding: '6px 10px',
                    color: 'var(--text-primary)', fontSize: '0.85rem',
                    cursor: 'pointer', outline: 'none',
                }}
            >
                {options.map((opt: any) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    );
}

function RowItem({ icon: Icon, title, subtitle, onClick, danger }: any) {
    return (
        <button
            onClick={onClick}
            style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderTop: '1px solid var(--glass-border)',
                background: 'none', border: 'none', width: '100%', textAlign: 'left',
                cursor: 'pointer', color: 'var(--text-primary)',
            }}
        >
            <Icon size={18} color={danger ? 'var(--coral)' : 'var(--text-secondary)'} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: '0.9rem', color: danger ? 'var(--coral)' : 'var(--text-primary)' }}>{title}</div>
                {subtitle && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{subtitle}</div>}
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
        </button>
    );
}

function ThemeOption({ active, onClick, icon: Icon, label, preview }: any) {
    const isLight = preview === 'light';
    return (
        <button
            onClick={onClick}
            style={{
                padding: 16, borderRadius: 14, cursor: 'pointer', textAlign: 'center',
                background: isLight ? '#f5f7fa' : '#0a0a0f',
                color: isLight ? '#1a1a2e' : '#f0f0f5',
                border: active ? '2px solid var(--coral)' : '2px solid var(--glass-border)',
                position: 'relative', transition: 'all 0.2s',
            }}
        >
            {active && (
                <div style={{
                    position: 'absolute', top: 6, right: 6,
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'var(--coral)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 700,
                }}>✓</div>
            )}
            <Icon size={28} style={{ marginBottom: 8 }} />
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</div>
            <div style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: 2 }}>
                {isLight ? 'Light background' : 'Dark background'}
            </div>
        </button>
    );
}


