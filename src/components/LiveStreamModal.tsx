import React, { useState, useEffect, useRef } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import type {
    IAgoraRTCClient,
    ICameraVideoTrack,
    IMicrophoneAudioTrack,
    IAgoraRTCRemoteUser,
} from 'agora-rtc-sdk-ng';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { X, Video, VideoOff, Mic, MicOff, Send, Users, Radio, Eye, Info, Volume2 } from 'lucide-react';

// ─── Your Agora App ID ────────────────────────────────────────────────────────
const AGORA_APP_ID = '24fe140693de45edbe771b4ffd7b6854';

// Suppress Agora's verbose console logs in production
AgoraRTC.setLogLevel(3); // 3 = ERROR only

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

export default function LiveStreamModal({
    streamId: propStreamId,
    streamTitle: propStreamTitle,
    isHost,
    onClose,
}: LiveStreamModalProps) {
    const { user, profile } = useAuth();
    const { showToast } = useToast();

    // ── Stream metadata ────────────────────────────────────────────────────
    const [streamId,       setStreamId]       = useState<string | null>(propStreamId || null);
    const [title,          setTitle]          = useState(propStreamTitle || '');
    const [isBroadcasting, setIsBroadcasting] = useState(false);
    const [viewerCount,    setViewerCount]    = useState(0);

    // ── UI states ──────────────────────────────────────────────────────────
    const [loading,       setLoading]       = useState(!isHost);
    const [connected,     setConnected]     = useState(false); // viewer: host track arrived
    const [cameraReady,   setCameraReady]   = useState(false);
    const [videoEnabled,  setVideoEnabled]  = useState(true);
    const [audioEnabled,  setAudioEnabled]  = useState(true);
    const [viewerMuted,   setViewerMuted]   = useState(true);
    const [chatOpen,      setChatOpen]      = useState(false);
    const [chatMessages,  setChatMessages]  = useState<ChatMessage[]>([]);
    const [messageText,   setMessageText]   = useState('');
    const [previewReady,  setPreviewReady]  = useState(false); // host camera preview

    // ── Refs ───────────────────────────────────────────────────────────────
    const clientRef          = useRef<IAgoraRTCClient | null>(null);
    const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);
    const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
    const remoteAudioTrackRef= useRef<any>(null);    // viewer: host audio track
    const previewTrackRef    = useRef<ICameraVideoTrack | null>(null); // host setup preview

    // DOM containers that Agora renders video INTO
    const localVideoElRef    = useRef<HTMLDivElement>(null);
    const remoteVideoElRef   = useRef<HTMLDivElement>(null);
    const previewVideoElRef  = useRef<HTMLDivElement>(null);

    // Supabase chat channel
    const chatChannelRef     = useRef<any>(null);
    const endedChannelRef    = useRef<any>(null);
    const chatEndRef         = useRef<HTMLDivElement>(null);

    // ── Auto-scroll chat ───────────────────────────────────────────────────
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    // ── Host: start camera preview immediately ─────────────────────────────
    useEffect(() => {
        if (isHost && !isBroadcasting) startCameraPreview();
        return () => {
            if (isHost && streamId) {
                supabase.from('live_streams')
                    .update({ status: 'ended', ended_at: new Date().toISOString() })
                    .eq('id', streamId).eq('status', 'live').then(() => {});
            }
            cleanup();
        };
    }, []);

    // ── Viewer: join as soon as the modal opens ────────────────────────────
    useEffect(() => {
        if (!isHost && streamId) startViewing();
    }, []);

    // ── Play preview track into div once div is ready ─────────────────────
    useEffect(() => {
        if (previewTrackRef.current && previewVideoElRef.current && previewReady) {
            previewTrackRef.current.play(previewVideoElRef.current);
        }
    }, [previewReady]);

    // ─────────────────────────────────────────────────────────────────────────
    //  CLEANUP
    // ─────────────────────────────────────────────────────────────────────────
    const cleanup = async () => {
        try {
            previewTrackRef.current?.stop();
            previewTrackRef.current?.close();
            localVideoTrackRef.current?.stop();
            localVideoTrackRef.current?.close();
            localAudioTrackRef.current?.stop();
            localAudioTrackRef.current?.close();
            if (clientRef.current) await clientRef.current.leave();
        } catch (_) {}
        if (chatChannelRef.current)  supabase.removeChannel(chatChannelRef.current);
        if (endedChannelRef.current) supabase.removeChannel(endedChannelRef.current);
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  HOST — Camera preview (before going live)
    // ─────────────────────────────────────────────────────────────────────────
    const startCameraPreview = async () => {
        try {
            const camTrack = await AgoraRTC.createCameraVideoTrack({
                encoderConfig: { width: 640, height: 480, frameRate: 15, bitrateMax: 800 },
            });
            previewTrackRef.current = camTrack;
            setCameraReady(true);
            setPreviewReady(true);
        } catch (err: any) {
            showToast('Camera access denied — check permissions.', 'error');
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  HOST — Go Live
    // ─────────────────────────────────────────────────────────────────────────
    const startStreaming = async () => {
        if (!title.trim()) { showToast('Please enter a stream title', 'error'); return; }
        setLoading(true);
        try {
            // 1. Create DB record
            const { data: stream, error: sErr } = await supabase
                .from('live_streams')
                .insert({ host_id: user!.id, title: title.trim(), status: 'live' })
                .select().single();
            if (sErr) throw sErr;
            const sid = stream.id;
            setStreamId(sid);

            // 2. Create Agora client in live-host mode
            const client = AgoraRTC.createClient({ mode: 'live', codec: 'h264' });
            clientRef.current = client;
            await client.setClientRole('host');

            // 3. Join channel (channel name = stream UUID)
            await client.join(AGORA_APP_ID, sid, null, user!.id.slice(0, 8));

            // 4. Re-use preview camera track if available, otherwise create fresh
            let videoTrack: ICameraVideoTrack;
            if (previewTrackRef.current) {
                videoTrack = previewTrackRef.current;
                previewTrackRef.current = null;
            } else {
                videoTrack = await AgoraRTC.createCameraVideoTrack({
                    encoderConfig: { width: 640, height: 480, frameRate: 15, bitrateMax: 800 },
                });
            }
            const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();

            localVideoTrackRef.current = videoTrack;
            localAudioTrackRef.current = audioTrack;

            // 5. Publish both tracks
            await client.publish([videoTrack, audioTrack]);

            // 6. Render local preview
            if (localVideoElRef.current) videoTrack.play(localVideoElRef.current);

            // 7. Viewer count tracking
            client.on('user-joined',  () => setViewerCount(c => c + 1));
            client.on('user-left',    () => setViewerCount(c => Math.max(0, c - 1)));

            // 8. Setup chat
            setupChatChannel(sid);

            setIsBroadcasting(true);
            setLoading(false);
            showToast('🎥 You are now LIVE! Viewers can join from their feed.', 'success');
        } catch (err: any) {
            console.error('[KSU-Live] Host start failed:', err);
            showToast('Could not start stream: ' + (err.message || err), 'error');
            setLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  HOST — Stop
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
            await cleanup();
            showToast('Live stream ended.', 'success');
            onClose();
        } catch (err) {
            onClose();
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  VIEWER — Join stream
    // ─────────────────────────────────────────────────────────────────────────
    const startViewing = async () => {
        setLoading(true);
        try {
            // Check stream still live
            const { data: streamData } = await supabase
                .from('live_streams').select('*').eq('id', streamId!).single();
            if (!streamData || streamData.status === 'ended') {
                showToast('This stream has already ended.', 'info');
                onClose();
                return;
            }

            // Create audience client
            const client = AgoraRTC.createClient({ mode: 'live', codec: 'h264' });
            clientRef.current = client;
            await client.setClientRole('audience', { level: 1 }); // 1 = low latency

            // Join channel
            const uid = Math.floor(Math.random() * 999999);
            await client.join(AGORA_APP_ID, streamId!, null, uid);

            // ── When host publishes video / audio ─────────────────────────
            client.on('user-published', async (remoteUser: IAgoraRTCRemoteUser, mediaType: 'video' | 'audio') => {
                await client.subscribe(remoteUser, mediaType);

                if (mediaType === 'video') {
                    if (remoteVideoElRef.current) {
                        remoteUser.videoTrack?.play(remoteVideoElRef.current);
                    }
                    setConnected(true);
                    setLoading(false);
                }

                if (mediaType === 'audio') {
                    remoteAudioTrackRef.current = remoteUser.audioTrack;
                    // Only play if viewer has already tapped unmute
                    if (!viewerMuted) remoteUser.audioTrack?.play();
                }
            });

            client.on('user-unpublished', (_user: IAgoraRTCRemoteUser, mediaType: 'video' | 'audio') => {
                if (mediaType === 'video') setConnected(false);
            });

            // ── Watch for stream end in DB ─────────────────────────────────
            const endedChan = supabase
                .channel(`stream_ended_view_${streamId}`)
                .on('postgres_changes', {
                    event: 'UPDATE', schema: 'public',
                    table: 'live_streams', filter: `id=eq.${streamId}`,
                }, (payload) => {
                    if ((payload.new as any).status === 'ended') {
                        showToast('The host has ended this stream.', 'info');
                        onClose();
                    }
                })
                .subscribe();
            endedChannelRef.current = endedChan;

            // Setup chat
            setupChatChannel(streamId!);

            // Fallback timeout to clear spinner
            setTimeout(() => setLoading(false), 15000);

        } catch (err: any) {
            console.error('[KSU-Live] Viewer join failed:', err);
            showToast('Failed to join stream: ' + (err.message || err), 'error');
            onClose();
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  CHAT
    // ─────────────────────────────────────────────────────────────────────────
    const setupChatChannel = (sid: string) => {
        const chan = supabase.channel(`stream_chat:${sid}`);
        chan.on('broadcast', { event: 'chat' }, ({ payload }: any) => {
            setChatMessages(prev => [...prev, {
                id: Math.random().toString(),
                senderId:   payload.senderId,
                senderName: payload.senderName,
                text:       payload.text,
                timestamp:  Date.now(),
            }]);
        }).subscribe();
        chatChannelRef.current = chan;
    };

    const sendChatMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageText.trim() || !chatChannelRef.current) return;
        chatChannelRef.current.send({
            type: 'broadcast', event: 'chat',
            payload: {
                senderId:   user!.id,
                senderName: profile?.username || 'User',
                text:       messageText.trim(),
            },
        });
        setChatMessages(prev => [...prev, {
            id: Math.random().toString(),
            senderId:   user!.id,
            senderName: profile?.username || 'User',
            text:       messageText.trim(),
            timestamp:  Date.now(),
        }]);
        setMessageText('');
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  HOST CONTROLS
    // ─────────────────────────────────────────────────────────────────────────
    const toggleVideo = () => {
        const track = localVideoTrackRef.current;
        if (!track) return;
        track.setEnabled(!videoEnabled);
        setVideoEnabled(v => !v);
    };

    const toggleAudio = () => {
        const track = localAudioTrackRef.current;
        if (!track) return;
        track.setEnabled(!audioEnabled);
        setAudioEnabled(a => !a);
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  VIEWER: UNMUTE
    // ─────────────────────────────────────────────────────────────────────────
    const handleViewerUnmute = () => {
        setViewerMuted(false);
        remoteAudioTrackRef.current?.play();
    };

    const handleViewerMute = () => {
        setViewerMuted(true);
        remoteAudioTrackRef.current?.stop();
    };

    // ─────────────────────────────────────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="stream-overlay">
            <div className="stream-container">

                {/* ═══ VIDEO PANEL ═══════════════════════════════════════════ */}
                <div className="stream-video-panel">

                    {/* Top bar */}
                    <div className="stream-top-bar">
                        <button className="stream-close-btn" onClick={isHost ? stopStreaming : onClose}>
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

                        {!isBroadcasting && isHost && (
                            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', fontWeight: 600 }}>
                                Live Setup
                            </div>
                        )}

                        {!isHost && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>
                                <Eye size={13} /> Watching live
                            </div>
                        )}
                    </div>

                    {/* Loading overlay */}
                    {loading && (
                        <div className="stream-loading">
                            <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
                            <p style={{ marginTop: 14 }}>
                                {isHost ? 'Starting broadcast…' : 'Joining stream…'}
                            </p>
                        </div>
                    )}

                    {/* ── HOST: Setup screen (before going live) ─────────── */}
                    {isHost && !isBroadcasting && (
                        <div className="stream-setup">
                            {/* Live camera preview */}
                            <div
                                ref={previewVideoElRef}
                                style={{
                                    position: 'absolute', inset: 0,
                                    display: cameraReady ? 'block' : 'none',
                                    transform: 'scaleX(-1)',
                                    background: '#000',
                                }}
                            />

                            <div className="stream-setup-overlay">
                                {cameraReady ? (
                                    <div className="stream-cam-ready">
                                        <span className="stream-cam-dot" />
                                        <span>Camera Ready</span>
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#a78bfa,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                                            <Radio size={24} color="white" />
                                        </div>
                                        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem', marginBottom: 10 }}>
                                            Camera not available. Check permissions.
                                        </p>
                                        <button onClick={startCameraPreview} className="btn btn-sm" style={{ background: 'rgba(167,139,250,0.35)', color: 'white' }}>
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

                                <div className="stream-info-hint">
                                    <Info size={11} />
                                    <span>Powered by Agora — viewers see & hear you in real time</span>
                                </div>

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

                    {/* ── HOST: Broadcasting view ─────────────────────────── */}
                    {isHost && isBroadcasting && (
                        <div
                            ref={localVideoElRef}
                            style={{
                                position: 'absolute', inset: 0,
                                background: '#000',
                                transform: 'scaleX(-1)', // mirror selfie
                            }}
                        />
                    )}

                    {/* ── VIEWER: Remote stream ───────────────────────────── */}
                    {!isHost && streamId && (
                        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                            {/* Agora renders video here */}
                            <div
                                ref={remoteVideoElRef}
                                style={{ position: 'absolute', inset: 0, background: '#000' }}
                            />

                            {/* Connecting overlay */}
                            {!connected && !loading && (
                                <div className="stream-loading" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
                                    <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3, marginBottom: 14 }} />
                                    <p style={{ opacity: 0.9 }}>Waiting for host to start…</p>
                                    <p style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: 6 }}>
                                        Powered by Agora
                                    </p>
                                </div>
                            )}

                            {/* Audio controls — always visible */}
                            <div style={{
                                position: 'absolute', bottom: 70, left: '50%',
                                transform: 'translateX(-50%)',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                                zIndex: 10,
                            }}>
                                {viewerMuted ? (
                                    <div
                                        onClick={handleViewerUnmute}
                                        style={{
                                            background: 'rgba(0,0,0,0.85)',
                                            borderRadius: 99, padding: '14px 30px',
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            cursor: 'pointer', color: 'white',
                                            fontSize: '1rem', fontWeight: 800,
                                            border: '2px solid rgba(255,255,255,0.45)',
                                            backdropFilter: 'blur(12px)',
                                            boxShadow: '0 4px 32px rgba(0,0,0,0.7)',
                                            animation: 'pulse 2s infinite',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        <Volume2 size={20} />
                                        🔇 Tap to hear audio
                                    </div>
                                ) : (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)',
                                        borderRadius: 99, padding: '8px 18px',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                    }}>
                                        <Volume2 size={16} color="white" />
                                        <span style={{ color: 'white', fontSize: '0.8rem', fontWeight: 600 }}>🔊 Audio on</span>
                                        <button
                                            onClick={handleViewerMute}
                                            style={{
                                                background: 'transparent', border: 'none',
                                                color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                                                fontSize: '0.7rem', fontWeight: 600,
                                            }}
                                        >Mute</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── HOST controls while broadcasting ───────────────── */}
                    {isHost && isBroadcasting && (
                        <div className="stream-controls">
                            <button
                                onClick={toggleVideo}
                                className="stream-ctrl-btn"
                                style={{ background: videoEnabled ? 'rgba(255,255,255,0.15)' : 'rgba(239,68,68,0.3)', color: videoEnabled ? 'white' : '#ef4444' }}
                            >
                                {videoEnabled ? <Video size={18} /> : <VideoOff size={18} />}
                            </button>
                            <button
                                onClick={toggleAudio}
                                className="stream-ctrl-btn"
                                style={{ background: audioEnabled ? 'rgba(255,255,255,0.15)' : 'rgba(239,68,68,0.3)', color: audioEnabled ? 'white' : '#ef4444' }}
                            >
                                {audioEnabled ? <Mic size={18} /> : <MicOff size={18} />}
                            </button>
                            <button onClick={stopStreaming} className="stream-end-btn">End</button>
                        </div>
                    )}
                </div>

                {/* ═══ CHAT PANEL ════════════════════════════════════════════ */}
                <div className={`stream-chat-panel ${chatOpen ? 'chat-open' : ''}`}>
                    <div className="stream-chat-header" onClick={() => setChatOpen(!chatOpen)} style={{ cursor: 'pointer' }}>
                        <Radio size={14} style={{ color: '#a78bfa' }} />
                        <span>Live Chat {chatMessages.length > 0 && `(${chatMessages.length})`}</span>
                        <span className="stream-chat-toggle">{chatOpen ? '▼' : '▲'}</span>
                        {isHost && isBroadcasting && (
                            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Info size={10} /> Share you're live!
                            </span>
                        )}
                    </div>

                    <div className="stream-chat-messages">
                        {chatMessages.map(msg => (
                            <div key={msg.id} className="stream-chat-msg">
                                <span className="stream-chat-name" style={{ color: '#06b6d4' }}>
                                    @{msg.senderName}
                                </span>
                                <span className="stream-chat-text">{msg.text}</span>
                            </div>
                        ))}
                        {chatMessages.length === 0 && (
                            <div className="stream-chat-empty">Welcome to chat! Say hello 👋</div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <form onSubmit={sendChatMessage} className="stream-chat-form">
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
