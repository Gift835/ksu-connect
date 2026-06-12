import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { X, Video, VideoOff, Mic, MicOff, Send, Users, Radio, Eye, Info } from 'lucide-react';

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

// STUN + TURN servers — using valid URL formats (no query-string in turn: URI)
const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
        // TCP TURN relay — works behind strict mobile NAT
        {
            urls: [
                'turn:openrelay.metered.ca:80',
                'turn:openrelay.metered.ca:443',
                'turns:openrelay.metered.ca:443',
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject',
        },
    ],
    iceCandidatePoolSize: 10,
};

export default function LiveStreamModal({ streamId: propStreamId, streamTitle: propStreamTitle, hostId: propHostId, isHost, onClose }: LiveStreamModalProps) {
    const { user, profile } = useAuth();
    const { showToast } = useToast();

    // Stream info states
    const [streamId, setStreamId] = useState<string | null>(propStreamId || null);
    const [title, setTitle] = useState(propStreamTitle || '');
    const [isBroadcasting, setIsBroadcasting] = useState(isHost && !!propStreamId);
    const [viewerCount, setViewerCount] = useState(0);

    // Media and Connection states
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [videoEnabled, setVideoEnabled] = useState(true);
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [loading, setLoading] = useState(!isHost);

    // Camera preview before going live
    const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [cameraReady, setCameraReady] = useState(false);

    // Chat states
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [messageText, setMessageText] = useState('');
    const [chatOpen, setChatOpen] = useState(false);
    const [autoPlayBlocked, setAutoPlayBlocked] = useState(false);
    const [viewerStatus, setViewerStatus] = useState('Connecting...');

    // Refs for video components
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const previewVideoRef = useRef<HTMLVideoElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // WebRTC Signaling Refs
    const channelRef = useRef<any>(null);
    const streamEndedChannelRef = useRef<any>(null); // separate channel for stream-ended DB watch
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const singlePeerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    // Buffer ICE candidates that arrive before remote description is set
    const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    // Start camera preview when host opens modal
    useEffect(() => {
        if (isHost && !isBroadcasting) {
            startCameraPreview();
        }
        return () => {
            // When host closes the modal (X button), auto-end the stream in DB
            if (isHost && streamId) {
                supabase.from('live_streams')
                    .update({ status: 'ended', ended_at: new Date().toISOString() })
                    .eq('id', streamId)
                    .eq('status', 'live') // only update if still live
                    .then(() => {});
            }
            cleanupConnections();
        };
    }, []);

    // Attach preview stream to video element
    useEffect(() => {
        if (previewStream && previewVideoRef.current) {
            previewVideoRef.current.srcObject = previewStream;
        }
    }, [previewStream]);

    // KEY FIX: Reliably attach remote stream to video element when it arrives
    useEffect(() => {
        if (!remoteStream || !remoteVideoRef.current) return;
        const video = remoteVideoRef.current;
        video.srcObject = remoteStream;
        video.play().catch(() => {
            // Browser blocked autoplay — show tap-to-play button
            setAutoPlayBlocked(true);
        });
    }, [remoteStream]);

    const startCameraPreview = async () => {
        setPreviewLoading(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, frameRate: 15, facingMode: 'user' },
                audio: true
            });
            setPreviewStream(stream);
            setCameraReady(true);
        } catch (err: any) {
            showToast('Camera access denied. Please allow camera/mic permissions.', 'error');
        } finally {
            setPreviewLoading(false);
        }
    };

    const cleanupConnections = async () => {
        // Stop preview stream tracks
        if (previewStream) {
            previewStream.getTracks().forEach(t => t.stop());
        }
        // Stop camera tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
        }
        // Close host connections
        peerConnectionsRef.current.forEach(pc => pc.close());
        peerConnectionsRef.current.clear();
        // Close viewer connection
        if (singlePeerConnectionRef.current) {
            singlePeerConnectionRef.current.close();
            singlePeerConnectionRef.current = null;
        }
        // Unsubscribe signaling channels
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }
        if (streamEndedChannelRef.current) {
            supabase.removeChannel(streamEndedChannelRef.current);
        }
    };

    // --- HOST SIDE CODE ---
    const startStreaming = async () => {
        if (!title.trim()) {
            showToast('Please enter a stream title', 'error');
            return;
        }
        setLoading(true);

        try {
            // Use the preview stream if available (so camera is already running)
            let media: MediaStream;
            if (previewStream && previewStream.active) {
                media = previewStream;
                setPreviewStream(null); // Transfer ownership
            } else {
                media = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, frameRate: 15, facingMode: 'user' },
                    audio: true
                });
            }

            setLocalStream(media);
            localStreamRef.current = media;

            // 2. Insert live_streams record in DB
            const { data: stream, error: sErr } = await supabase.from('live_streams').insert({
                host_id: user!.id,
                title: title.trim(),
                status: 'live'
            }).select().single();

            if (sErr) throw sErr;
            setStreamId(stream.id);
            setIsBroadcasting(true);

            // Attach to video element
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = media;
            }

            // 3. Initialize signaling channel
            setupHostSignaling(stream.id, media);
            showToast('🎥 You are now LIVE! Followers can join from their feed.', 'success');
        } catch (err: any) {
            console.error('Failed to start stream', err);
            showToast('Could not access camera/mic: ' + (err.message || err), 'error');
        } finally {
            setLoading(false);
        }
    };

    // Attach local stream to video element once both are ready
    useEffect(() => {
        if (localStream && localVideoRef.current && isBroadcasting) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream, isBroadcasting]);

    const setupHostSignaling = (channelStreamId: string, media: MediaStream) => {
        const broadcastChan = supabase.channel(`stream_bcast:${channelStreamId}`);

        // Listen on Broadcast only for: chat messages + ICE candidates from viewers
        broadcastChan.on('broadcast', { event: '*' }, async ({ event, payload }) => {
            const { senderId, targetId, candidate, senderName, text } = payload;

            if (event === 'chat') {
                setChatMessages(prev => [...prev, {
                    id: Math.random().toString(), senderId, senderName, text, timestamp: Date.now()
                }]);
                return;
            }

            // ICE candidates from viewers — fast path via Broadcast
            if (event === 'candidate' && targetId === user!.id) {
                const pc = peerConnectionsRef.current.get(senderId);
                if (pc && candidate) {
                    if (pc.remoteDescription) {
                        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
                    } else {
                        const buf = pendingCandidatesRef.current.get(senderId) || [];
                        buf.push(candidate);
                        pendingCandidatesRef.current.set(senderId, buf);
                    }
                }
            }
        });

        broadcastChan.subscribe();
        channelRef.current = broadcastChan;

        // *** DATABASE-BACKED SIGNALING — guaranteed delivery ***
        // Watch for 'join' and 'answer' signals in the DB targeted at host
        const sigChannel = supabase
            .channel(`db_signals_host_${channelStreamId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'stream_signals',
                filter: `to_user_id=eq.${user!.id}`,
            }, async ({ new: signal }: any) => {
                if (signal.stream_id !== channelStreamId) return;

                if (signal.type === 'join') {
                    const viewerId = signal.from_user_id;
                    if (peerConnectionsRef.current.has(viewerId)) return; // already connected

                    console.log('DB signal: viewer joined', viewerId);
                    const pc = new RTCPeerConnection(ICE_SERVERS);
                    peerConnectionsRef.current.set(viewerId, pc);

                    // Add all local tracks
                    media.getTracks().forEach(track => pc.addTrack(track, media));

                    // Send ICE candidates to viewer via Broadcast (fast)
                    pc.onicecandidate = (e) => {
                        if (e.candidate && channelRef.current) {
                            channelRef.current.send({
                                type: 'broadcast',
                                event: 'candidate',
                                payload: { senderId: user!.id, targetId: viewerId, candidate: e.candidate }
                            });
                        }
                    };

                    // Create and store offer in DB
                    try {
                        const sdpOffer = await pc.createOffer();
                        await pc.setLocalDescription(sdpOffer);
                        await supabase.from('stream_signals').insert({
                            stream_id: channelStreamId,
                            from_user_id: user!.id,
                            to_user_id: viewerId,
                            type: 'offer',
                            payload: pc.localDescription,
                        });
                        setViewerCount(c => c + 1);
                        showToast('👀 Someone joined your stream!', 'info');
                    } catch (err) {
                        console.error('Failed to create offer:', err);
                    }

                } else if (signal.type === 'answer') {
                    const viewerId = signal.from_user_id;
                    const pc = peerConnectionsRef.current.get(viewerId);
                    if (pc && signal.payload) {
                        try {
                            await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
                            // Flush buffered ICE candidates
                            const pending = pendingCandidatesRef.current.get(viewerId) || [];
                            for (const c of pending) {
                                try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
                            }
                            pendingCandidatesRef.current.delete(viewerId);
                        } catch (err) {
                            console.error('Failed to set answer:', err);
                        }
                    }
                }
            })
            .subscribe();
    };

    const stopStreaming = async () => {
        if (!window.confirm('Are you sure you want to end this live stream?')) return;
        setLoading(true);
        try {
            if (streamId) {
                await supabase.from('live_streams')
                    .update({ status: 'ended', ended_at: new Date().toISOString() })
                    .eq('id', streamId);
                // Also broadcast via realtime so viewers get notified instantly
                if (channelRef.current) {
                    channelRef.current.send({
                        type: 'broadcast',
                        event: 'stream_ended',
                        payload: { streamId }
                    });
                }
            }
            cleanupConnections();
            showToast('Live stream ended successfully', 'success');
            onClose();
        } catch (err: any) {
            console.error('Error ending stream', err);
            onClose();
        }
    };

    // --- VIEWER SIDE CODE ---
    useEffect(() => {
        if (!isHost && streamId) {
            startViewing();
        }
    }, [streamId]);

    const startViewing = async () => {
        setLoading(true);
        try {
            const { data: stream, error } = await supabase.from('live_streams')
                .select('*').eq('id', streamId!).single();

            if (error || !stream) { showToast('Could not load stream.', 'error'); onClose(); return; }
            if (stream.status === 'ended') { showToast('This live stream has already ended.', 'info'); onClose(); return; }

            // Create peer connection
            let pc: RTCPeerConnection;
            try { pc = new RTCPeerConnection(ICE_SERVERS); }
            catch (pcErr: any) { showToast('WebRTC error: ' + pcErr.message, 'error'); onClose(); return; }
            singlePeerConnectionRef.current = pc;

            // Tell WebRTC we want to RECEIVE video+audio
            try {
                pc.addTransceiver('video', { direction: 'recvonly' });
                pc.addTransceiver('audio', { direction: 'recvonly' });
            } catch { /* older browsers — continue */ }

            let pendingViewerCandidates: RTCIceCandidateInit[] = [];
            let remoteSet = false;
            const rStream = new MediaStream();

            // ontrack: fires when host's video/audio arrives
            pc.ontrack = (e) => {
                if (!rStream.getTrackById(e.track.id)) rStream.addTrack(e.track);
                setRemoteStream(new MediaStream(rStream.getTracks()));
                setLoading(false);
            };

            // ICE state tracking
            pc.oniceconnectionstatechange = () => {
                if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') setLoading(false);
                if (pc.iceConnectionState === 'failed') { try { pc.restartIce(); } catch {} }
            };
            pc.onconnectionstatechange = () => {
                if (pc.connectionState === 'connected') setLoading(false);
            };

            // ─── BROADCAST CHANNEL ─── for chat + ICE candidates + stream_ended (fast path)
            const bcastChan = supabase.channel(`stream_bcast:${streamId}`);
            channelRef.current = bcastChan;

            bcastChan.on('broadcast', { event: '*' }, async ({ event, payload }) => {
                const { targetId, candidate, senderName, senderId: msgSender, text } = payload;

                if (event === 'chat') {
                    setChatMessages(prev => [...prev, {
                        id: Math.random().toString(), senderId: msgSender,
                        senderName, text, timestamp: Date.now()
                    }]);
                    return;
                }

                // Host ended the stream — close immediately
                if (event === 'stream_ended') {
                    showToast('The host has ended this live stream.', 'info');
                    onClose();
                    return;
                }

                // ICE candidates FROM HOST to this viewer
                if (event === 'candidate' && targetId === user!.id && candidate) {
                    if (remoteSet) {
                        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
                    } else {
                        pendingViewerCandidates.push(candidate);
                    }
                }
            });

            // Send viewer ICE candidates to host via Broadcast
            pc.onicecandidate = (e) => {
                if (e.candidate && channelRef.current) {
                    channelRef.current.send({
                        type: 'broadcast', event: 'candidate',
                        payload: { senderId: user!.id, targetId: propHostId!, candidate: e.candidate }
                    });
                }
            };

            bcastChan.subscribe();

            // ─── DATABASE SIGNALING ─── for offer (guaranteed delivery)
            const sigSub = supabase
                .channel(`db_signals_viewer_${user!.id}_${streamId}`)
                .on('postgres_changes', {
                    event: 'INSERT', schema: 'public', table: 'stream_signals',
                    filter: `to_user_id=eq.${user!.id}`,
                }, async ({ new: signal }: any) => {
                    if (signal.stream_id !== streamId || signal.type !== 'offer') return;

                    try {
                        await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
                        remoteSet = true;

                        // Flush buffered ICE candidates
                        for (const c of pendingViewerCandidates) {
                            try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
                        }
                        pendingViewerCandidates = [];

                        const sdpAnswer = await pc.createAnswer();
                        await pc.setLocalDescription(sdpAnswer);

                        // Store answer in DB for host to pick up
                        await supabase.from('stream_signals').insert({
                            stream_id: streamId,
                            from_user_id: user!.id,
                            to_user_id: propHostId!,
                            type: 'answer',
                            payload: pc.localDescription,
                        });
                    } catch (err) {
                        console.error('Error processing offer:', err);
                    }
                })
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        // Send 'join' to host via DB — guaranteed delivery
                        await supabase.from('stream_signals').insert({
                            stream_id: streamId,
                            from_user_id: user!.id,
                            to_user_id: propHostId!,
                            type: 'join',
                            payload: null,
                        });
                    }
                });

            // Watch for stream ending via DB (fallback in case broadcast missed)
            const endedChannel = supabase.channel(`stream_ended_${streamId}_${user!.id}`)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_streams', filter: `id=eq.${streamId}` },
                    (payload) => {
                        if ((payload.new as any).status === 'ended') {
                            showToast('The host has ended this live stream.', 'info');
                            onClose();
                        }
                    })
                .subscribe();
            streamEndedChannelRef.current = endedChannel;

            // Auto-timeout loading spinner after 20s
            setTimeout(() => setLoading(false), 20000);

        } catch (err: any) {
            console.error('Viewer setup failed:', err);
            showToast('Failed to set up stream: ' + (err.message || err), 'error');
            onClose();
        }
    };

    const sendChatMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageText.trim() || !channelRef.current) return;

        channelRef.current.send({
            type: 'broadcast',
            event: 'chat',
            payload: {
                senderId: user!.id,
                senderName: profile?.username || 'User',
                text: messageText.trim()
            }
        });

        const msg: ChatMessage = {
            id: Math.random().toString(),
            senderId: user!.id,
            senderName: profile?.username || 'User',
            text: messageText.trim(),
            timestamp: Date.now()
        };
        setChatMessages(prev => [...prev, msg]);
        setMessageText('');
    };

    const toggleVideo = () => {
        if (localStream) {
            const track = localStream.getVideoTracks()[0];
            if (track) {
                track.enabled = !videoEnabled;
                setVideoEnabled(!videoEnabled);
            }
        }
    };

    const toggleAudio = () => {
        if (localStream) {
            const track = localStream.getAudioTracks()[0];
            if (track) {
                track.enabled = !audioEnabled;
                setAudioEnabled(!audioEnabled);
            }
        }
    };

    return (
        <div className="stream-overlay">
            {/* ---- Main Container ---- */}
            <div className="stream-container">

                {/* ===== VIDEO PANEL ===== */}
                <div className="stream-video-panel">
                    {/* Top bar: LIVE badge + Close */}
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
                            <p>{isHost ? 'Starting your broadcast...' : 'Connecting to broadcast...'}</p>
                        </div>
                    )}

                    {/* Pre-stream Setup: Camera Preview */}
                    {isHost && !isBroadcasting && (
                        <div className="stream-setup">
                            {/* Live camera preview fills behind — mirrored like a selfie camera */}
                            <video
                                ref={previewVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="stream-preview-video"
                                style={{
                                    display: cameraReady ? 'block' : 'none',
                                    transform: 'scaleX(-1)',  /* mirror so host sees themselves naturally */
                                }}
                            />

                            {/* Dark gradient overlay at bottom for controls */}
                            <div className="stream-setup-overlay">
                                {previewLoading && (
                                    <div className="stream-cam-status">
                                        <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                                        <span>Accessing camera...</span>
                                    </div>
                                )}

                                {!cameraReady && !previewLoading && (
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
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

                                {cameraReady && (
                                    <div className="stream-cam-ready">
                                        <span className="stream-cam-dot" />
                                        <span>Camera Ready</span>
                                    </div>
                                )}

                                {/* Title input */}
                                <input
                                    className="stream-title-input"
                                    placeholder="Enter stream title..."
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    maxLength={80}
                                />

                                <div className="stream-info-hint">
                                    <Info size={11} />
                                    <span>Followers can join from their feed</span>
                                </div>

                                <button
                                    className="stream-go-live-btn"
                                    onClick={startStreaming}
                                    disabled={!title.trim()}
                                >
                                    <Radio size={15} /> Go Live Now
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Host broadcasting video — mirrored for natural selfie feel */}
                    {isHost && isBroadcasting && (
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="stream-live-video"
                            style={{ transform: 'scaleX(-1)' }}
                        />
                    )}

                    {/* Viewer remote video */}
                    {!isHost && streamId && (
                        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                muted={false}
                                onCanPlay={(e) => {
                                    // Force play when media is ready — handles browsers that ignore autoPlay
                                    const v = e.currentTarget;
                                    if (v.paused) v.play().catch(() => setAutoPlayBlocked(true));
                                }}
                                className="stream-live-video"
                            />
                            {/* Tap-to-play overlay (iOS/some Android block autoplay) */}
                            {autoPlayBlocked && (
                                <div
                                    className="stream-loading"
                                    style={{ background: 'rgba(0,0,0,0.7)', cursor: 'pointer' }}
                                    onClick={() => {
                                        remoteVideoRef.current?.play();
                                        setAutoPlayBlocked(false);
                                    }}
                                >
                                    <div style={{
                                        width: 64, height: 64, borderRadius: '50%',
                                        background: 'rgba(255,255,255,0.15)',
                                        border: '2px solid rgba(255,255,255,0.4)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <span style={{ fontSize: '1.8rem' }}>▶️</span>
                                    </div>
                                    <p style={{ marginTop: 10 }}>Tap to play stream</p>
                                </div>
                            )}
                            {!remoteStream && !loading && (
                                <div className="stream-loading" style={{ background: 'transparent' }}>
                                    <Eye size={28} style={{ opacity: 0.3 }} />
                                    <p>Waiting for host video...</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Host controls while broadcasting */}
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
                            <button onClick={stopStreaming} className="stream-end-btn">
                                End
                            </button>
                        </div>
                    )}
                </div>

                {/* ===== CHAT PANEL ===== */}
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
                                <span className="stream-chat-name" style={{
                                    color: msg.senderId === propHostId || (isHost && msg.senderId === user!.id) ? '#a78bfa' : '#06b6d4'
                                }}>
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
                            placeholder="Send a message..."
                            value={messageText}
                            onChange={e => setMessageText(e.target.value)}
                            disabled={!isBroadcasting && isHost}
                        />
                        <button
                            type="submit"
                            className="stream-chat-send"
                            disabled={(!isBroadcasting && isHost) || !messageText.trim()}
                        >
                            <Send size={15} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
