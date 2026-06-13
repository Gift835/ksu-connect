import React, { useState, useEffect, useRef, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import type {
    IAgoraRTCClient,
    ICameraVideoTrack,
    IMicrophoneAudioTrack,
    IAgoraRTCRemoteUser,
    IRemoteAudioTrack,
} from 'agora-rtc-sdk-ng';
// Vite handles CJS→ESM interop for agora-access-token automatically
import { RtcTokenBuilder, RtcRole } from 'agora-access-token';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { X, Video, VideoOff, Mic, MicOff, Send, Users, Radio, Eye, Volume2, VolumeX } from 'lucide-react';

// ─── Agora App credentials ────────────────────────────────────────────────────
// App ID is public. App Certificate is used client-side to sign tokens — this
// avoids needing a separate token server during development.
const AGORA_APP_ID   = 'c63f70ea4bbe48a3821166f59aa2d8d1';
const AGORA_APP_CERT = '9f2c6f468574470eb86461754472ee8c';

// Suppress Agora SDK console noise in non-error cases
AgoraRTC.setLogLevel(3); // 3 = warn+error only

// ─── Token generation (client-side, no server required) ─────────────────────
function buildAgoraToken(channel: string, uid: number, role: 'publisher' | 'subscriber'): string | null {
    try {
        if (!AGORA_APP_CERT) return null;
        const expireTime = Math.floor(Date.now() / 1000) + 3600;
        const rtcRole    = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
        return RtcTokenBuilder.buildTokenWithUid(
            AGORA_APP_ID,
            AGORA_APP_CERT,
            channel,
            uid,
            rtcRole,
            expireTime,
        );
    } catch (err) {
        console.error('[KSU-Live] Token build failed:', err);
        return null;
    }
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface LiveStreamModalProps {
    streamId?: string;
    streamTitle?: string;
    hostId?: string;
    isHost: boolean;
    onClose: () => void;
}

interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string;
    text: string;
    timestamp: number;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LiveStreamModal({
    streamId: propStreamId,
    streamTitle: propStreamTitle,
    isHost,
    onClose,
}: LiveStreamModalProps) {
    const { user, profile } = useAuth();
    const { showToast } = useToast();

    // ── Stream state ───────────────────────────────────────────────────────
    const [streamId,       setStreamId]       = useState<string | null>(propStreamId ?? null);
    const [title,          setTitle]          = useState(propStreamTitle ?? '');
    const [isBroadcasting, setIsBroadcasting] = useState(false);
    const [viewerCount,    setViewerCount]    = useState(0);
    const [phase, setPhase]                   = useState<'setup' | 'live' | 'viewer'>('setup');

    // ── UI flags ───────────────────────────────────────────────────────────
    const [loading,      setLoading]      = useState(false);
    const [cameraOk,     setCameraOk]     = useState(false);
    const [videoOn,      setVideoOn]      = useState(true);
    const [audioOn,      setAudioOn]      = useState(true);
    const [viewerMuted,  setViewerMuted]  = useState(true);
    const [chatOpen,     setChatOpen]     = useState(false);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [messageText,  setMessageText]  = useState('');
    const [remoteVideoReady, setRemoteVideoReady] = useState(false);

    // ── Agora refs ─────────────────────────────────────────────────────────
    const clientRef       = useRef<IAgoraRTCClient | null>(null);
    const localVidRef     = useRef<ICameraVideoTrack | null>(null);
    const localAudRef     = useRef<IMicrophoneAudioTrack | null>(null);
    const previewTrackRef = useRef<ICameraVideoTrack | null>(null);
    const remoteAudRef    = useRef<IRemoteAudioTrack | null>(null);

    // ── DOM containers for Agora video ─────────────────────────────────────
    const previewDivRef  = useRef<HTMLDivElement>(null);
    const localDivRef    = useRef<HTMLDivElement>(null);
    const remoteDivRef   = useRef<HTMLDivElement>(null);

    // ── Supabase channels ──────────────────────────────────────────────────
    const chatChanRef    = useRef<any>(null);
    const endedChanRef   = useRef<any>(null);
    const chatEndRef     = useRef<HTMLDivElement>(null);

    // ── Auto-scroll chat ───────────────────────────────────────────────────
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    // ── On mount: start preview (host) or join stream (viewer) ────────────
    useEffect(() => {
        if (isHost) {
            startPreview();
        } else if (propStreamId) {
            setPhase('viewer');
            joinStream(propStreamId);
        }

        return () => {
            doCleanup();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    //  CLEANUP
    // ─────────────────────────────────────────────────────────────────────────
    const doCleanup = useCallback(async () => {
        try { previewTrackRef.current?.stop(); previewTrackRef.current?.close(); } catch (_) {}
        try { localVidRef.current?.stop();     localVidRef.current?.close();     } catch (_) {}
        try { localAudRef.current?.stop();     localAudRef.current?.close();     } catch (_) {}
        try { remoteAudRef.current?.stop();                                       } catch (_) {}
        try { if (clientRef.current) await clientRef.current.leave();             } catch (_) {}
        try { if (chatChanRef.current)  supabase.removeChannel(chatChanRef.current);  } catch (_) {}
        try { if (endedChanRef.current) supabase.removeChannel(endedChanRef.current); } catch (_) {}
        clientRef.current = null;
        previewTrackRef.current = null;
        localVidRef.current = null;
        localAudRef.current = null;
        remoteAudRef.current = null;
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    //  HOST — Camera preview
    // ─────────────────────────────────────────────────────────────────────────
    const startPreview = async () => {
        try {
            const cam = await AgoraRTC.createCameraVideoTrack({
                encoderConfig: { width: 1280, height: 720, frameRate: 24, bitrateMax: 1200 },
            });
            previewTrackRef.current = cam;
            setCameraOk(true);
            // Play into div — wait for next paint so the div is in the DOM
            requestAnimationFrame(() => {
                if (previewDivRef.current) cam.play(previewDivRef.current);
            });
        } catch (err: any) {
            console.warn('[KSU-Live] Camera preview failed:', err);
            showToast('Camera access denied — check browser permissions.', 'error');
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  HOST — Go Live
    // ─────────────────────────────────────────────────────────────────────────
    const startStreaming = async () => {
        if (!title.trim()) { showToast('Please enter a stream title.', 'error'); return; }
        setLoading(true);
        let insertedId: string | null = null;

        try {
            // 1. Insert DB record
            const { data: stream, error: dbErr } = await supabase
                .from('live_streams')
                .insert({ host_id: user!.id, title: title.trim(), status: 'live' })
                .select()
                .single();
            if (dbErr) throw dbErr;
            insertedId = stream.id;
            const sid  = stream.id;
            setStreamId(sid);

            // 2. Create Agora client
            const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
            clientRef.current = client;
            await client.setClientRole('host');

            // 3. Generate token (client-side — no server needed)
            const uid   = Math.floor(Math.random() * 999_999) + 1;
            const token = buildAgoraToken(sid, uid, 'publisher');

            // 4. Join channel
            await client.join(AGORA_APP_ID, sid, token, uid);

            // 5. Re-use preview track if available, else create fresh
            let videoTrack: ICameraVideoTrack;
            if (previewTrackRef.current) {
                videoTrack = previewTrackRef.current;
                previewTrackRef.current = null;
            } else {
                videoTrack = await AgoraRTC.createCameraVideoTrack({
                    encoderConfig: { width: 1280, height: 720, frameRate: 24, bitrateMax: 1200 },
                });
            }
            const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
            localVidRef.current = videoTrack;
            localAudRef.current = audioTrack;

            // 6. Publish tracks
            await client.publish([videoTrack, audioTrack]);

            // 7. Render local preview into live div
            requestAnimationFrame(() => {
                if (localDivRef.current) videoTrack.play(localDivRef.current);
            });

            // 8. Viewer count listeners
            client.on('user-joined', () => setViewerCount(c => c + 1));
            client.on('user-left',   () => setViewerCount(c => Math.max(0, c - 1)));

            // 9. Chat
            setupChat(sid);

            setIsBroadcasting(true);
            setPhase('live');
            setLoading(false);
            showToast('🎥 You are now LIVE!', 'success');

        } catch (err: any) {
            console.error('[KSU-Live] Go-live failed:', err);
            if (insertedId) {
                await supabase.from('live_streams')
                    .update({ status: 'ended', ended_at: new Date().toISOString() })
                    .eq('id', insertedId);
            }
            await doCleanup();
            const msg = err?.message ?? String(err);
            showToast('Could not start stream: ' + msg, 'error');
            setLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  HOST — End stream
    // ─────────────────────────────────────────────────────────────────────────
    const stopStreaming = async () => {
        if (!window.confirm('End this live stream?')) return;
        setLoading(true);
        try {
            if (streamId) {
                await supabase.from('live_streams')
                    .update({ status: 'ended', ended_at: new Date().toISOString() })
                    .eq('id', streamId);
            }
        } catch (_) {}
        await doCleanup();
        onClose();
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  VIEWER — Join stream
    // ─────────────────────────────────────────────────────────────────────────
    const joinStream = async (sid: string) => {
        setLoading(true);
        try {
            // Verify still live
            const { data: streamData } = await supabase
                .from('live_streams').select('*').eq('id', sid).single();
            if (!streamData || streamData.status === 'ended') {
                showToast('This stream has already ended.', 'info');
                onClose();
                return;
            }

            // Create client
            const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
            clientRef.current = client;
            await client.setClientRole('audience', { level: 1 });

            // Generate token
            const uid   = Math.floor(Math.random() * 999_999) + 1;
            const token = buildAgoraToken(sid, uid, 'subscriber');

            // Join
            await client.join(AGORA_APP_ID, sid, token, uid);

            // Handle incoming tracks
            client.on('user-published', async (remoteUser: IAgoraRTCRemoteUser, mediaType: 'video' | 'audio') => {
                await client.subscribe(remoteUser, mediaType);

                if (mediaType === 'video') {
                    // Play into the remote div — it's always mounted in the viewer phase
                    requestAnimationFrame(() => {
                        if (remoteDivRef.current && remoteUser.videoTrack) {
                            remoteUser.videoTrack.play(remoteDivRef.current);
                        }
                    });
                    setRemoteVideoReady(true);
                    setLoading(false);
                }

                if (mediaType === 'audio') {
                    remoteAudRef.current = remoteUser.audioTrack ?? null;
                    // audio only plays after user taps unmute (browser autoplay policy)
                }
            });

            client.on('user-unpublished', (_user: IAgoraRTCRemoteUser, mediaType: 'video' | 'audio') => {
                if (mediaType === 'video') setRemoteVideoReady(false);
            });

            // Watch for stream ending in DB
            const endedChan = supabase
                .channel(`stream_ended_${sid}`)
                .on('postgres_changes', {
                    event: 'UPDATE', schema: 'public',
                    table: 'live_streams', filter: `id=eq.${sid}`,
                }, (payload) => {
                    if ((payload.new as any).status === 'ended') {
                        showToast('The host has ended this stream.', 'info');
                        onClose();
                    }
                })
                .subscribe();
            endedChanRef.current = endedChan;

            // Setup chat
            setupChat(sid);

            // Fallback: clear spinner after 20s if video never arrives
            setTimeout(() => setLoading(false), 20_000);

        } catch (err: any) {
            console.error('[KSU-Live] Viewer join failed:', err);
            showToast('Failed to join stream: ' + (err.message ?? err), 'error');
            onClose();
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  CHAT
    // ─────────────────────────────────────────────────────────────────────────
    const setupChat = (sid: string) => {
        const chan = supabase.channel(`stream_chat:${sid}`);
        chan.on('broadcast', { event: 'chat' }, ({ payload }: any) => {
            setChatMessages(prev => [...prev, {
                id:         Math.random().toString(36).slice(2),
                senderId:   payload.senderId,
                senderName: payload.senderName,
                text:       payload.text,
                timestamp:  Date.now(),
            }]);
        }).subscribe();
        chatChanRef.current = chan;
    };

    const sendChat = (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageText.trim() || !chatChanRef.current) return;
        const msg = {
            senderId:   user!.id,
            senderName: profile?.username ?? 'User',
            text:       messageText.trim(),
        };
        chatChanRef.current.send({ type: 'broadcast', event: 'chat', payload: msg });
        setChatMessages(prev => [...prev, {
            id:        Math.random().toString(36).slice(2),
            timestamp: Date.now(),
            ...msg,
        }]);
        setMessageText('');
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  HOST MEDIA TOGGLES
    // ─────────────────────────────────────────────────────────────────────────
    const toggleVideo = () => {
        const t = localVidRef.current;
        if (!t) return;
        const next = !videoOn;
        t.setEnabled(next);
        setVideoOn(next);
    };

    const toggleAudio = () => {
        const t = localAudRef.current;
        if (!t) return;
        const next = !audioOn;
        t.setEnabled(next);
        setAudioOn(next);
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  VIEWER AUDIO
    // ─────────────────────────────────────────────────────────────────────────
    const unmute = () => {
        remoteAudRef.current?.play();
        setViewerMuted(false);
    };
    const mute = () => {
        remoteAudRef.current?.stop();
        setViewerMuted(true);
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="stream-overlay">
            <div className="stream-container">

                {/* ══════════════ VIDEO PANEL ══════════════════════════════ */}
                <div className="stream-video-panel">

                    {/* Top bar */}
                    <div className="stream-top-bar">
                        <button
                            className="stream-close-btn"
                            onClick={isHost && isBroadcasting ? stopStreaming : onClose}
                            title={isHost && isBroadcasting ? 'End stream' : 'Close'}
                        >
                            <X size={18} />
                        </button>

                        {isBroadcasting && (
                            <div className="stream-live-badge">
                                <span className="stream-live-dot" />
                                <span>LIVE</span>
                                {isHost && (
                                    <span className="stream-viewers">
                                        <Users size={11} /> {viewerCount}
                                    </span>
                                )}
                            </div>
                        )}

                        {!isBroadcasting && isHost && phase === 'setup' && (
                            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', fontWeight: 600 }}>
                                Live Setup
                            </div>
                        )}

                        {phase === 'viewer' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem' }}>
                                <Eye size={13} /> Watching live
                            </div>
                        )}
                    </div>

                    {/* Loading overlay */}
                    {loading && (
                        <div className="stream-loading">
                            <div className="spinner" style={{ width: 44, height: 44, borderWidth: 3 }} />
                            <p style={{ marginTop: 14, fontWeight: 600 }}>
                                {isHost ? 'Starting broadcast…' : 'Joining stream…'}
                            </p>
                        </div>
                    )}

                    {/* ── HOST SETUP SCREEN ─────────────────────────────── */}
                    {isHost && phase === 'setup' && (
                        <div className="stream-setup">
                            {/* Camera preview — always in DOM so the ref is stable */}
                            <div
                                ref={previewDivRef}
                                style={{
                                    position: 'absolute', inset: 0,
                                    background: '#000',
                                    display: cameraOk ? 'block' : 'none',
                                    transform: 'scaleX(-1)',
                                }}
                            />

                            <div className="stream-setup-overlay">
                                {cameraOk ? (
                                    <div className="stream-cam-ready">
                                        <span className="stream-cam-dot" />
                                        <span>Camera Ready</span>
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{
                                            width: 52, height: 52, borderRadius: '50%',
                                            background: 'linear-gradient(135deg,#a78bfa,#7c3aed)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            margin: '0 auto 10px',
                                        }}>
                                            <Radio size={24} color="white" />
                                        </div>
                                        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem', marginBottom: 10 }}>
                                            Camera not available — check permissions.
                                        </p>
                                        <button onClick={startPreview} className="btn btn-sm" style={{ background: 'rgba(167,139,250,0.35)', color: 'white' }}>
                                            Retry Camera
                                        </button>
                                    </div>
                                )}

                                <input
                                    className="stream-title-input"
                                    placeholder="Enter stream title…"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    maxLength={80}
                                />

                                <button
                                    className="stream-go-live-btn"
                                    onClick={startStreaming}
                                    disabled={!title.trim() || loading}
                                >
                                    <Radio size={15} /> Go Live Now
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── HOST BROADCASTING VIEW ────────────────────────── */}
                    {isHost && phase === 'live' && (
                        <div
                            ref={localDivRef}
                            style={{
                                position: 'absolute', inset: 0,
                                background: '#000',
                                transform: 'scaleX(-1)',
                            }}
                        />
                    )}

                    {/* ── VIEWER: REMOTE STREAM ─────────────────────────── */}
                    {phase === 'viewer' && (
                        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                            {/* Agora renders host video here */}
                            <div
                                ref={remoteDivRef}
                                style={{ position: 'absolute', inset: 0, background: '#000' }}
                            />

                            {/* Waiting overlay while video is connecting */}
                            {!remoteVideoReady && !loading && (
                                <div className="stream-loading" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}>
                                    <div className="spinner" style={{ width: 44, height: 44, borderWidth: 3, marginBottom: 14 }} />
                                    <p style={{ opacity: 0.9, fontWeight: 600 }}>Waiting for host video…</p>
                                </div>
                            )}

                            {/* Viewer audio controls */}
                            {remoteVideoReady && (
                                <div style={{
                                    position: 'absolute', bottom: 72, left: '50%',
                                    transform: 'translateX(-50%)',
                                    zIndex: 10,
                                }}>
                                    {viewerMuted ? (
                                        <div
                                            onClick={unmute}
                                            style={{
                                                background: 'rgba(0,0,0,0.85)',
                                                borderRadius: 99, padding: '12px 28px',
                                                display: 'flex', alignItems: 'center', gap: 10,
                                                cursor: 'pointer', color: 'white',
                                                fontSize: '0.95rem', fontWeight: 800,
                                                border: '2px solid rgba(255,255,255,0.4)',
                                                backdropFilter: 'blur(12px)',
                                                boxShadow: '0 4px 32px rgba(0,0,0,0.7)',
                                                animation: 'pulse 2s infinite',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            <Volume2 size={20} /> Tap to hear audio
                                        </div>
                                    ) : (
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)',
                                            borderRadius: 99, padding: '8px 16px',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                        }}>
                                            <Volume2 size={16} color="white" />
                                            <span style={{ color: 'white', fontSize: '0.8rem', fontWeight: 600 }}>🔊 Audio on</span>
                                            <button
                                                onClick={mute}
                                                style={{
                                                    background: 'transparent', border: 'none',
                                                    color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                                                    fontSize: '0.7rem', fontWeight: 700,
                                                }}
                                            >
                                                <VolumeX size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── HOST CONTROLS WHILE LIVE ─────────────────────── */}
                    {isHost && phase === 'live' && !loading && (
                        <div className="stream-controls">
                            <button
                                onClick={toggleVideo}
                                className="stream-ctrl-btn"
                                title={videoOn ? 'Turn off camera' : 'Turn on camera'}
                                style={{
                                    background: videoOn ? 'rgba(255,255,255,0.15)' : 'rgba(239,68,68,0.3)',
                                    color: videoOn ? 'white' : '#ef4444',
                                }}
                            >
                                {videoOn ? <Video size={18} /> : <VideoOff size={18} />}
                            </button>
                            <button
                                onClick={toggleAudio}
                                className="stream-ctrl-btn"
                                title={audioOn ? 'Mute mic' : 'Unmute mic'}
                                style={{
                                    background: audioOn ? 'rgba(255,255,255,0.15)' : 'rgba(239,68,68,0.3)',
                                    color: audioOn ? 'white' : '#ef4444',
                                }}
                            >
                                {audioOn ? <Mic size={18} /> : <MicOff size={18} />}
                            </button>
                            <button onClick={stopStreaming} className="stream-end-btn">End</button>
                        </div>
                    )}
                </div>

                {/* ══════════════ CHAT PANEL ══════════════════════════════ */}
                <div className={`stream-chat-panel ${chatOpen ? 'chat-open' : ''}`}>
                    <div
                        className="stream-chat-header"
                        onClick={() => setChatOpen(o => !o)}
                        style={{ cursor: 'pointer' }}
                    >
                        <Radio size={14} style={{ color: '#a78bfa' }} />
                        <span>Live Chat {chatMessages.length > 0 && `(${chatMessages.length})`}</span>
                        <span className="stream-chat-toggle">{chatOpen ? '▼' : '▲'}</span>
                    </div>

                    <div className="stream-chat-messages">
                        {chatMessages.length === 0 && (
                            <div className="stream-chat-empty">Welcome to chat! Say hello 👋</div>
                        )}
                        {chatMessages.map(msg => (
                            <div key={msg.id} className="stream-chat-msg">
                                <span className="stream-chat-name" style={{ color: '#06b6d4' }}>
                                    @{msg.senderName}
                                </span>
                                <span className="stream-chat-text">{msg.text}</span>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    <form onSubmit={sendChat} className="stream-chat-form">
                        <input
                            className="stream-chat-input"
                            placeholder="Send a message…"
                            value={messageText}
                            onChange={e => setMessageText(e.target.value)}
                        />
                        <button type="submit" className="stream-chat-send" disabled={!messageText.trim()}>
                            <Send size={15} />
                        </button>
                    </form>
                </div>

            </div>
        </div>
    );
}
