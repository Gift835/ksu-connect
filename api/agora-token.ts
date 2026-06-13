import type { VercelRequest, VercelResponse } from './vercel-types';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

// ─── Agora token endpoint ─────────────────────────────────────────────────────
// GET /api/agora-token?channel=<channelName>&uid=<uid>&role=publisher|subscriber
// Returns: { token: string }
//
// REQUIRED environment variables (set in Vercel dashboard):
//   AGORA_APP_ID          = c63f70ea4bbe48a3821166f59aa2d8d1
//   AGORA_APP_CERTIFICATE = (your App Certificate — never commit to git)
// ─────────────────────────────────────────────────────────────────────────────
export default function handler(req: VercelRequest, res: VercelResponse) {
    // CORS — allow the app itself to call this
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const APP_ID   = process.env.AGORA_APP_ID;
    const APP_CERT = process.env.AGORA_APP_CERTIFICATE;

    if (!APP_ID || !APP_CERT) {
        console.error('[agora-token] Missing env vars AGORA_APP_ID or AGORA_APP_CERTIFICATE');
        return res.status(500).json({ error: 'Server is not configured for Agora tokens.' });
    }

    const { channel, uid, role } = req.query;

    if (!channel || typeof channel !== 'string') {
        return res.status(400).json({ error: 'Missing required query param: channel' });
    }

    const numericUid  = parseInt((uid as string) || '0', 10);
    const rtcRole     = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const expireTime  = Math.floor(Date.now() / 1000) + 3600; // valid 1 hour

    try {
        const token = RtcTokenBuilder.buildTokenWithUid(
            APP_ID,
            APP_CERT,
            channel,
            numericUid,
            rtcRole,
            expireTime,
            expireTime,
        );
        return res.status(200).json({ token });
    } catch (err: any) {
        console.error('[agora-token] Build failed:', err);
        return res.status(500).json({ error: 'Token generation failed: ' + err.message });
    }
}
