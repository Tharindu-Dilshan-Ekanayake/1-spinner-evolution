import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import compression from 'compression'
import cors from 'cors'
import express from 'express'

import { BLOXITY, verifyPlayer } from './bloxity.js'
import { getLeaderboards } from './game/leaderboard.js'

// Vite's dev server origin. Add the production origin here (or via CLIENT_ORIGIN)
// when you deploy.
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  ...(process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',') : []),
]

const CLIENT_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist')

/**
 * Plain HTTP routes, mounted on the same server as the Colyseus websocket.
 * Colyseus's own routes (matchmaking) are checked first; these are the fallback.
 *
 * @param {import('express').Application} app
 */
export function registerHttpRoutes(app) {
  // gzip the client bundle and API responses (the websocket is unaffected).
  app.use(compression())
  app.use(
    cors({
      origin: ALLOWED_ORIGINS,
      credentials: true,
    }),
  )
  app.use(express.json())

  // Boxity hosting checks /health; keep it instant.
  app.get(['/health', '/api/health'], (_req, res) => {
    res.json({ ok: true })
  })

  app.get('/api/leaderboards', (_req, res) => {
    res.json(getLeaderboards())
  })

  /**
   * `Legion.SDK.auth.authenticateWithServer('/api/legion-auth')` target. The game
   * itself doesn't need it (the room checks the token on join, WorldRoom.onAuth); it
   * answers with the identity Boxity vouches for, never the user in the body.
   */
  app.post('/api/legion-auth', async (req, res) => {
    const who = await verifyPlayer(String(req.body?.token || ''), BLOXITY.gameSlug || String(req.body?.gameSlug || ''))
    res.json(who ? { valid: true, userId: who.userId } : { valid: false })
  })

  /**
   * Webhook for future Bux purchases.
   * Responds 200 immediately — the platform will retry on anything else, so do the
   * real work asynchronously rather than holding the response open.
   * (This game sells nothing for Bux; kept so the platform's webhook stays valid.)
   */
  app.post('/api/legion-webhook', (req, res) => {
    // Nothing is sold, so there is never anything to grant; answer 2xx so Boxity
    // doesn't treat the endpoint as broken.
    console.log('[legion-webhook] ignored (no Gems products):', req.body?.sku, req.body?.transactionId)
    res.sendStatus(200)
  })

  // Production: serve the built client from the same origin as the game server.
  if (fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST, { maxAge: '1h', index: 'index.html' }))
  }
}
