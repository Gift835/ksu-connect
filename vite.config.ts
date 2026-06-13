import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load ALL env vars (including non-VITE_ prefixed ones like AGORA_APP_CERTIFICATE)
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),

      // ── Dev-only: serve /api/agora-token so local `npm run dev` works
      //    without needing `vercel dev`.  On production the real Vercel
      //    serverless function in api/agora-token.ts handles the route.
      {
        name: 'agora-token-dev',
        apply: 'serve',
        configureServer(server) {
          server.middlewares.use('/api/agora-token', async (req, res) => {
            try {
              // Dynamic import handles CJS/ESM interop
              const mod = await import('agora-token') as any
              const RtcTokenBuilder = mod.RtcTokenBuilder ?? mod.default?.RtcTokenBuilder
              const RtcRole         = mod.RtcRole         ?? mod.default?.RtcRole

              const APP_ID   = env.AGORA_APP_ID
              const APP_CERT = env.AGORA_APP_CERTIFICATE

              if (!APP_ID || !APP_CERT) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Missing AGORA_APP_ID or AGORA_APP_CERTIFICATE in .env' }))
                return
              }

              // Parse query params from the URL
              const rawUrl = req.url ?? ''
              const qs = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?')) : ''
              const params = new URLSearchParams(qs)
              const channel = params.get('channel')
              const uid     = parseInt(params.get('uid') ?? '0', 10)
              const role    = params.get('role')

              if (!channel) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Missing required query param: channel' }))
                return
              }

              const rtcRole    = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER
              const expireTime = Math.floor(Date.now() / 1000) + 3600

              const token = RtcTokenBuilder.buildTokenWithUid(
                APP_ID, APP_CERT, channel, uid, rtcRole, expireTime, expireTime,
              )

              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.end(JSON.stringify({ token }))
            } catch (err: any) {
              console.error('[agora-token-dev]', err)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Token generation failed: ' + err.message }))
            }
          })
        },
      },
    ],
  }
})
