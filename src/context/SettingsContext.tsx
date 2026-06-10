import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type ThemeMode = 'dark' | 'light';
export type Language = 'en' | 'pcm' | 'yo' | 'ig' | 'ha';
export type FontSize = 'small' | 'medium' | 'large';

export interface AppSettings {
    theme: ThemeMode;
    language: Language;
    fontSize: FontSize;
    notifications: {
        push: boolean;
        email: boolean;
        likes: boolean;
        comments: boolean;
        follows: boolean;
        messages: boolean;
        marketing: boolean;
    };
    privacy: {
        privateAccount: boolean;
        showActivity: boolean;
        allowMentions: 'everyone' | 'followers' | 'none';
        allowMessages: 'everyone' | 'followers' | 'none';
    };
    content: {
        autoplayVideos: boolean;
        sensitiveContent: boolean;
        languageFilter: boolean;
    };
}

const DEFAULT_SETTINGS: AppSettings = {
    theme: 'dark',
    language: 'en',
    fontSize: 'medium',
    notifications: {
        push: true,
        email: true,
        likes: true,
        comments: true,
        follows: true,
        messages: true,
        marketing: false,
    },
    privacy: {
        privateAccount: false,
        showActivity: true,
        allowMentions: 'everyone',
        allowMessages: 'everyone',
    },
    content: {
        autoplayVideos: true,
        sensitiveContent: false,
        languageFilter: true,
    },
};

interface SettingsContextType {
    settings: AppSettings;
    update: (key: keyof AppSettings, value: any) => void;
    updateNested: (key: keyof AppSettings, path: string[], value: any) => void;
    reset: () => void;
}


const SettingsContext = createContext<SettingsContextType | null>(null);

const STORAGE_KEY = 'ksu_settings';

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<AppSettings>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
        } catch { }
        return DEFAULT_SETTINGS;
    });

    // Apply theme
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', settings.theme);
    }, [settings.theme]);

    // Apply font size
    useEffect(() => {
        const sizeMap = { small: '14px', medium: '16px', large: '18px' };
        document.documentElement.style.fontSize = sizeMap[settings.fontSize];
    }, [settings.fontSize]);

    // Persist
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch { }
    }, [settings]);

    const update = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    }, []);

    const updateNested = useCallback((key: keyof AppSettings, path: string[], value: any) => {
        setSettings(prev => {
            const obj = { ...(prev[key] as any) };
            let current: any = obj;
            for (let i = 0; i < path.length - 1; i++) {
                current[path[i]] = { ...current[path[i]] };
                current = current[path[i]];
            }
            current[path[path.length - 1]] = value;
            return { ...prev, [key]: obj };
        });
    }, []);


    const reset = useCallback(() => {
        setSettings(DEFAULT_SETTINGS);
    }, []);

    return (
        <SettingsContext.Provider value={{ settings, update, updateNested, reset }}>
            {children}
        </SettingsContext.Provider>
    );
}

export const useSettings = () => {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
    return ctx;
};
