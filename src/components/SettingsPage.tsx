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


type Section = 'main' | 'appearance' | 'notifications' | 'privacy' | 'content' | 'account' | 'about';

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
                        { value: 'pcm', label: '🇳🇬 Pidgin' },
                        { value: 'yo', label: '🇳🇬 Yoruba' },
                        { value: 'ig', label: '🇳🇬 Igbo' },
                        { value: 'ha', label: '🇳🇬 Hausa' },
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
                <RowItem icon={HelpCircle} title="Help Center" onClick={() => showToast('Email: support@ksuconnect.app', 'info')} />
                <RowItem icon={Mail} title="Contact us" subtitle="support@ksuconnect.app" onClick={() => showToast('support@ksuconnect.app', 'info')} />
            </SettingGroup>

            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', padding: 16 }}>
                Made with ❤️ for KSU students
            </p>
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


