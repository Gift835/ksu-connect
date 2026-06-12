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

// STUN + free TURN servers for mobile network relay
const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // Free TURN relay — works behind mobile carrier NAT
        { urls: 'turn:openrelay.metered.ca:80',      username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443',     username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    ]
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

    // Refs for video components
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const previewVideoRef = useRef<HTMLVideoElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // WebRTC Signaling Refs
    const channelRef = useRef<any>(null);
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
            cleanupConnections();
        };
    }, []);

    // Attach preview stream to video element
    useEffect(() => {
        if (previewStream && previewVideoRef.current) {
            previewVideoRef.current.srcObject = previewStream;
        }
    }, [previewStream]);

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
        // Unsubscribe signaling channel
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
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
        const channelName = `stream_signaling:${channelStreamId}`;
        const chan = supabase.channel(channelName);

        chan.on('broadcast', { event: '*' }, async ({ event, payload }) => {
            const { senderId, targetId, offer, answer, candidate, senderName, text } = payload;

            if (event === 'chat') {
                const msg: ChatMessage = {
                    id: Math.random().toString(),
                    senderId,
                    senderName,
                    text,
                    timestamp: Date.now()
                };
                setChatMessages(prev => [...prev, msg]);
                return;
            }

            if (targetId !== user!.id && event !== 'join') return;

            if (event === 'join') {
                console.log('Viewer joined:', senderId);
                const pc = new RTCPeerConnection(ICE_SERVERS);
                peerConnectionsRef.current.set(senderId, pc);

                media.getTracks().forEach(track => {
                    pc.addTrack(track, media);
                });

                pc.onicecandidate = (e) => {
                    if (e.candidate) {
                        chan.send({
                            type: 'broadcast',
                            event: 'candidate',
                            payload: {
                                senderId: user!.id,
                                targetId: senderId,
                                candidate: e.candidate
                            }
                        });
                    }
                };

                const sdpOffer = await pc.createOffer();
                await pc.setLocalDescription(sdpOffer);

                chan.send({
                    type: 'broadcast',
                    event: 'offer',
                    payload: {
                        senderId: user!.id,
                        targetId: senderId,
                        offer: pc.localDescription
                    }
                });

                setViewerCount(c => c + 1);
                showToast(`👀 Someone joined your stream!`, 'info');
            } else if (event === 'answer') {
                const pc = peerConnectionsRef.current.get(senderId);
                if (pc) {
                    await pc.setRemoteDescription(new RTCSessionDescription(answer));
                    // Flush any buffered ICE candidates
                    const pending = pendingCandidatesRef.current.get(senderId) || [];
                    for (const c of pending) {
                        try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
                    }
                    pendingCandidatesRef.current.delete(senderId);
                }
            } else if (event === 'candidate') {
                const pc = peerConnectionsRef.current.get(senderId);
                if (pc) {
                    if (pc.remoteDescription) {
                        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
                    } else {
                        // Buffer until remote description is set
                        const buf = pendingCandidatesRef.current.get(senderId) || [];
                        buf.push(candidate);
                        pendingCandidatesRef.current.set(senderId, buf);
                    }
                }
            }
        });

        chan.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('Host subscribed to signaling channel');
            }
        });

        channelRef.current = chan;
    };

    const stopStreaming = async () => {
        if (!window.confirm('Are you sure you want to end this live stream?')) return;
        setLoading(true);
        try {
            if (streamId) {
                await supabase.from('live_streams')
                    .update({ status: 'ended', ended_at: new Date().toISOString() })
                    .eq('id', streamId);
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
                .select('*')
                .eq('id', streamId!)
                .single();

            if (error || !stream || stream.status === 'ended') {
                showToast('This live stream has ended.', 'error');
                onClose();
                return;
            }

            const pc = new RTCPeerConnection(ICE_SERVERS);
            singlePeerConnectionRef.current = pc;

            // Buffer of ICE candidates that arrive before offer
            let pendingViewerCandidates: RTCIceCandidateInit[] = [];
            let remoteSet = false;

            const rStream = new MediaStream();
            setRemoteStream(rStream);

            // Handle incoming tracks — fires when host sends video
            pc.ontrack = (e) => {
                e.streams[0]?.getTracks().forEach(track => rStream.addTrack(track));
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = e.streams[0] || rStream;
                }
                setLoading(false);
            };

            // Handle ICE candidates going out to host
            pc.onicecandidate = (e) => {
                if (e.candidate && channelRef.current) {
                    channelRef.current.send({
                        type: 'broadcast',
                        event: 'candidate',
                        payload: {
                            senderId: user!.id,
                            targetId: propHostId!,
                            candidate: e.candidate
                        }
                    });
                }
            };

            pc.onconnectionstatechange = () => {
                if (pc.connectionState === 'connected') setLoading(false);
                if (pc.connectionState === 'failed') {
                    showToast('Connection lost. Try rejoining.', 'error');
                }
            };

            const channelName = `stream_signaling:${streamId}`;
            const chan = supabase.channel(channelName);
            channelRef.current = chan;

            chan.on('broadcast', { event: '*' }, async ({ event, payload }) => {
                const { targetId, offer, candidate, senderName, senderId: msgSender, text } = payload;

                if (event === 'chat') {
                    const msg: ChatMessage = {
                        id: Math.random().toString(),
                        senderId: msgSender,
                        senderName,
                        text,
                        timestamp: Date.now()
                    };
                    setChatMessages(prev => [...prev, msg]);
                    return;
                }

                if (targetId !== user!.id) return;

                if (event === 'offer') {
                    try {
                        await pc.setRemoteDescription(new RTCSessionDescription(offer));
                        remoteSet = true;

                        // Flush buffered candidates
                        for (const c of pendingViewerCandidates) {
                            try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
                        }
                        pendingViewerCandidates = [];

                        const sdpAnswer = await pc.createAnswer();
                        await pc.setLocalDescription(sdpAnswer);

                        chan.send({
                            type: 'broadcast',
                            event: 'answer',
                            payload: {
                                senderId: user!.id,
                                targetId: propHostId!,
                                answer: pc.localDescription
                            }
                        });
                    } catch (err) {
                        console.error('Error handling offer:', err);
                    }
                } else if (event === 'candidate' && candidate) {
                    if (remoteSet) {
                        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
                    } else {
                        pendingViewerCandidates.push(candidate);
                    }
                }
            });

            chan.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // Signal host that we joined
                    chan.send({
                        type: 'broadcast',
                        event: 'join',
                        payload: { senderId: user!.id, targetId: propHostId! }
                    });
                    // Re-ping after 2s in case host missed it
                    setTimeout(() => {
                        if (!remoteSet && chan) {
                            chan.send({
                                type: 'broadcast',
                                event: 'join',
                                payload: { senderId: user!.id, targetId: propHostId! }
                            });
                        }
                    }, 2000);
                }
            });

            // Detect stream ending via DB
            const dbSub = supabase.channel(`stream_ended_${streamId}`)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_streams', filter: `id=eq.${streamId}` },
                    (payload) => {
                        if ((payload.new as any).status === 'ended') {
                            showToast('The host has ended this live stream.', 'info');
                            onClose();
                        }
                    })
                .subscribe();

            // Auto-timeout loading after 15s
            setTimeout(() => setLoading(false), 15000);

        } catch (err: any) {
            console.error('Viewer setup failed', err);
            showToast('Failed to connect to stream', 'error');
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
                            {/* Live camera preview fills behind */}
                            <video
                                ref={previewVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="stream-preview-video"
                                style={{ display: cameraReady ? 'block' : 'none' }}
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

                    {/* Host broadcasting video */}
                    {isHost && isBroadcasting && (
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            className="stream-live-video"
                        />
                    )}

                    {/* Viewer remote video */}
                    {!isHost && streamId && (
                        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                className="stream-live-video"
                            />
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
                <div className="stream-chat-panel">
                    <div className="stream-chat-header">
                        <Radio size={14} style={{ color: '#a78bfa' }} />
                        <span>Live Chat</span>
                        {isHost && isBroadcasting && (
                            <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 3 }}>
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
