import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { X, Video, VideoOff, Mic, MicOff, Send, Users, Radio } from 'lucide-react';

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

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
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

    // Chat states
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [messageText, setMessageText] = useState('');

    // Refs for video components
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // WebRTC Signaling Refs
    const channelRef = useRef<any>(null);
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map()); // viewerId -> PC (For Host)
    const singlePeerConnectionRef = useRef<RTCPeerConnection | null>(null); // For Viewer
    const localStreamRef = useRef<MediaStream | null>(null);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    // Cleanup function when component unmounts
    useEffect(() => {
        return () => {
            cleanupConnections();
        };
    }, []);

    const cleanupConnections = async () => {
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
            // 1. Get User Media
            const media = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, frameRate: 15 },
                audio: true
            });
            setLocalStream(media);
            localStreamRef.current = media;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = media;
            }

            // 2. Insert live_streams record in DB
            const { data: stream, error: sErr } = await supabase.from('live_streams').insert({
                host_id: user!.id,
                title: title.trim(),
                status: 'live'
            }).select().single();

            if (sErr) throw sErr;
            setStreamId(stream.id);
            setIsBroadcasting(true);

            // 3. Initialize signaling channel
            setupHostSignaling(stream.id, media);
            showToast('Live broadcast started! 🎥', 'success');
        } catch (err: any) {
            console.error('Failed to start stream', err);
            showToast('Could not access camera/mic: ' + (err.message || err), 'error');
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const setupHostSignaling = (channelStreamId: string, media: MediaStream) => {
        const channelName = `stream_signaling:${channelStreamId}`;
        const chan = supabase.channel(channelName);

        chan.on('broadcast', { event: '*' }, async ({ event, payload }) => {
            const { senderId, targetId, offer, answer, candidate, senderName, text } = payload;

            // Handle incoming chat messages
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

            // Target verification: host is targetId
            if (targetId !== user!.id && event !== 'join') return;

            if (event === 'join') {
                console.log('Viewer joined:', senderId);
                // Create RTCPeerConnection for this viewer
                const pc = new RTCPeerConnection(ICE_SERVERS);
                peerConnectionsRef.current.set(senderId, pc);

                // Add local tracks to peer connection
                media.getTracks().forEach(track => {
                    pc.addTrack(track, media);
                });

                // ICE Candidate gathering
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

                // Create Offer
                const sdpOffer = await pc.createOffer();
                await pc.setLocalDescription(sdpOffer);

                // Send Offer to viewer
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
                showToast(`New viewer connected!`, 'info');
            } else if (event === 'answer') {
                console.log('Received answer from:', senderId);
                const pc = peerConnectionsRef.current.get(senderId);
                if (pc) {
                    await pc.setRemoteDescription(new RTCSessionDescription(answer));
                }
            } else if (event === 'candidate') {
                console.log('Received candidate from:', senderId);
                const pc = peerConnectionsRef.current.get(senderId);
                if (pc && candidate) {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
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
            // Verify stream is still active
            const { data: stream, error } = await supabase.from('live_streams')
                .select('*')
                .eq('id', streamId!)
                .single();

            if (error || !stream || stream.status === 'ended') {
                showToast('This live stream has ended.', 'error');
                onClose();
                return;
            }

            // Setup peer connection
            const pc = new RTCPeerConnection(ICE_SERVERS);
            singlePeerConnectionRef.current = pc;

            // Handle receiving remote tracks
            const rStream = new MediaStream();
            setRemoteStream(rStream);
            pc.ontrack = (e) => {
                console.log('Received remote track:', e.track.kind);
                rStream.addTrack(e.track);
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = rStream;
                }
            };

            // Setup signaling channel
            const channelName = `stream_signaling:${streamId}`;
            const chan = supabase.channel(channelName);

            chan.on('broadcast', { event: '*' }, async ({ event, payload }) => {
                const { senderId, targetId, offer, candidate, senderName, text } = payload;

                // Handle incoming chat messages
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

                // Verify the offer/candidate is meant for us
                if (targetId !== user!.id) return;

                if (event === 'offer') {
                    console.log('Received offer from host');
                    await pc.setRemoteDescription(new RTCSessionDescription(offer));
                    const sdpAnswer = await pc.createAnswer();
                    await pc.setLocalDescription(sdpAnswer);

                    // Send Answer back to host
                    chan.send({
                        type: 'broadcast',
                        event: 'answer',
                        payload: {
                            senderId: user!.id,
                            targetId: propHostId!,
                            answer: pc.localDescription
                        }
                    });
                    setLoading(false);
                } else if (event === 'candidate') {
                    console.log('Received candidate from host');
                    if (candidate) {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    }
                }
            });

            chan.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Viewer signaling subscribed. Joining stream...');
                    // Broadcast join event
                    chan.send({
                        type: 'broadcast',
                        event: 'join',
                        payload: {
                            senderId: user!.id,
                            targetId: propHostId!
                        }
                    });

                    // Gather viewer ICE candidates and send to host
                    pc.onicecandidate = (e) => {
                        if (e.candidate) {
                            chan.send({
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
                }
            });

            // Listen to live_streams table updates for stream ending
            const dbSub = supabase.channel('stream_ended_check')
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_streams', filter: `id=eq.${streamId}` },
                    (payload) => {
                        if (payload.new.status === 'ended') {
                            showToast('The host has ended this live stream.', 'info');
                            onClose();
                        }
                    })
                .subscribe();

            channelRef.current = chan;
        } catch (err: any) {
            console.error('Viewer setup failed', err);
            showToast('Failed to connect to stream', 'error');
            onClose();
        }
    };

    // Chat Message Submission
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

        // Add locally immediately
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
        <div className="modal-overlay" style={{ background: 'rgba(0, 0, 0, 0.95)', zIndex: 999 }}>
            <div style={{
                width: '100%',
                maxWidth: 1000,
                height: '85vh',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--border-radius-lg)',
                border: '1px solid var(--glass-border)',
                display: 'grid',
                gridTemplateColumns: '1fr 320px',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-card)',
                position: 'relative'
            }}>
                {/* Close Button */}
                <button
                    onClick={isHost ? stopStreaming : onClose}
                    style={{
                        position: 'absolute', top: 12, left: 12,
                        background: 'rgba(0,0,0,0.6)', border: '1px solid var(--glass-border)',
                        color: 'white', cursor: 'pointer', borderRadius: '50%',
                        width: 32, height: 32, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', zIndex: 50
                    }}
                >
                    <X size={16} />
                </button>

                {/* Left side: Video Area */}
                <div style={{ background: '#000', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
                    {/* Pulsing Live indicator */}
                    {isBroadcasting && (
                        <div style={{
                            position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 6,
                            background: 'rgba(255, 107, 107, 0.2)', border: '1px solid rgba(255,107,107,0.4)',
                            padding: '4px 10px', borderRadius: 999, zIndex: 10
                        }}>
                            <span style={{ width: 8, height: 8, background: 'var(--coral, #ff6b6b)', borderRadius: '50%', display: 'inline-block', animation: 'bgPulse 1s ease-in-out infinite alternate' }} />
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ff6b6b', letterSpacing: 0.5 }}>LIVE</span>
                            {isHost && (
                                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', marginLeft: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Users size={12} /> {viewerCount}
                                </span>
                            )}
                        </div>
                    )}

                    {loading && (
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
                            <div className="spinner" style={{ width: 44, height: 44, borderWidth: 3 }} />
                            <p style={{ marginTop: 16, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                {isHost ? 'Accessing your camera feed...' : 'Connecting to broadcast...'}
                            </p>
                        </div>
                    )}

                    {/* Pre-stream Setup for Host */}
                    {isHost && !isBroadcasting && (
                        <div style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 440, margin: '0 auto', zIndex: 10 }}>
                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                                <Radio size={32} color="white" />
                            </div>
                            <h2 style={{ fontSize: '1.25rem', marginBottom: 8, textAlign: 'center' }}>Start Live Stream</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginBottom: 20 }}>
                                Broadcast your video and audio feed live to all your followers on KSU Connect!
                            </p>
                            <input
                                className="input"
                                placeholder="Enter stream title (e.g. My study setup...)"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                style={{ marginBottom: 16, width: '100%' }}
                            />
                            <button className="btn w-full" style={{ background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', color: 'white', fontWeight: 700 }} onClick={startStreaming}>
                                <Video size={16} style={{ marginRight: 6 }} /> Go Live Now
                            </button>
                        </div>
                    )}

                    {/* Video Player */}
                    {isHost && isBroadcasting && (
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            muted
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    )}

                    {!isHost && streamId && (
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    )}

                    {/* Media Control bar (For Host) */}
                    {isHost && isBroadcasting && (
                        <div style={{
                            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                            display: 'flex', gap: 12, background: 'rgba(0, 0, 0, 0.75)',
                            padding: '8px 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <button
                                onClick={toggleVideo}
                                className="btn btn-icon btn-sm"
                                style={{ background: videoEnabled ? 'rgba(255,255,255,0.1)' : 'rgba(239, 68, 68, 0.2)', color: videoEnabled ? 'white' : '#ef4444' }}
                            >
                                {videoEnabled ? <Video size={16} /> : <VideoOff size={16} />}
                            </button>
                            <button
                                onClick={toggleAudio}
                                className="btn btn-icon btn-sm"
                                style={{ background: audioEnabled ? 'rgba(255,255,255,0.1)' : 'rgba(239, 68, 68, 0.2)', color: audioEnabled ? 'white' : '#ef4444' }}
                            >
                                {audioEnabled ? <Mic size={16} /> : <MicOff size={16} />}
                            </button>
                            <button
                                onClick={stopStreaming}
                                className="btn btn-danger btn-sm"
                                style={{ padding: '6px 14px', fontSize: '0.8rem', fontWeight: 700 }}
                            >
                                End Broadcast
                            </button>
                        </div>
                    )}
                </div>

                {/* Right side: Chat Panel */}
                <div style={{
                    display: 'flex', flexDirection: 'column', height: '100%',
                    borderLeft: '1px solid var(--glass-border)', background: 'rgba(15, 15, 26, 0.8)'
                }}>
                    {/* Chat Header */}
                    <div style={{ padding: 16, borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Radio size={16} className="gradient-text" />
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Live Stream Chat</span>
                    </div>

                    {/* Chat Scrollable Area */}
                    <div style={{ flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {chatMessages.map(msg => (
                            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{
                                    fontSize: '0.75rem', fontWeight: 800,
                                    color: msg.senderId === propHostId || (isHost && msg.senderId === user!.id) ? '#a78bfa' : 'var(--neon-blue)'
                                }}>
                                    @{msg.senderName}
                                </span>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', wordBreak: 'break-word', lineHeight: 1.4 }}>
                                    {msg.text}
                                </span>
                            </div>
                        ))}
                        {chatMessages.length === 0 && (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '40px 0' }}>
                                Welcome to chat! Say hello 👋
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Chat Input form */}
                    <form onSubmit={sendChatMessage} style={{ padding: 12, borderTop: '1px solid var(--glass-border)', display: 'flex', gap: 6 }}>
                        <input
                            className="input"
                            placeholder="Send a comment..."
                            value={messageText}
                            onChange={e => setMessageText(e.target.value)}
                            style={{ flex: 1, height: 36, padding: '8px 12px', borderRadius: 999, fontSize: '0.82rem' }}
                            disabled={!isBroadcasting && isHost}
                        />
                        <button
                            type="submit"
                            className="btn btn-primary btn-icon"
                            style={{ width: 36, height: 36, flexShrink: 0 }}
                            disabled={(!isBroadcasting && isHost) || !messageText.trim()}
                        >
                            <Send size={14} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
