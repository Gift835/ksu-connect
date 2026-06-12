import React, { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';

/* ─────────────────────────────────────────────────────
   PWA Install Prompt
   Shows an "Add to Home Screen" banner for Android Chrome
   (iOS shows a manual prompt since Safari doesn't fire
    beforeinstallprompt — we guide them with a tip instead)
───────────────────────────────────────────────────── */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // Don't show if user already dismissed this session
    if (sessionStorage.getItem('pwa-dismissed')) return;

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    if (ios) {
      // Show iOS tip after 3 seconds
      setTimeout(() => setShowBanner(true), 3000);
      return;
    }

    // Android / Chrome — listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    sessionStorage.setItem('pwa-dismissed', '1');
  };

  if (!showBanner || dismissed) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      left: 12,
      right: 12,
      zIndex: 9999,
      background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
      border: '1px solid rgba(99,102,241,0.4)',
      borderRadius: 18,
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.2)',
      animation: 'slideUpIn 0.4s cubic-bezier(0.16,1,0.3,1)',
    }}>
      {/* App icon */}
      <div style={{
        width: 48, height: 48,
        borderRadius: 14,
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
      }}>
        <Smartphone size={24} color="white" />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff', marginBottom: 2 }}>
          Install KSU Connect
        </div>
        {isIOS ? (
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>
            Tap <strong style={{ color: '#a78bfa' }}>Share</strong> then{' '}
            <strong style={{ color: '#a78bfa' }}>"Add to Home Screen"</strong>
          </div>
        ) : (
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)' }}>
            Add to home screen for the best experience
          </div>
        )}
      </div>

      {/* Install button (Android only) */}
      {!isIOS && deferredPrompt && (
        <button
          onClick={handleInstall}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            border: 'none', borderRadius: 10,
            color: '#fff', fontWeight: 700, fontSize: '0.82rem',
            cursor: 'pointer', flexShrink: 0,
            fontFamily: "'Inter', sans-serif",
            boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
          }}
        >
          <Download size={14} /> Install
        </button>
      )}

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        style={{
          background: 'rgba(255,255,255,0.1)', border: 'none',
          color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
          borderRadius: '50%', width: 28, height: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
