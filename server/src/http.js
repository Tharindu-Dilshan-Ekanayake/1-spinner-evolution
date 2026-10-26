import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import compression from 'compression'
import cors from 'cors'
import express from 'express'

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

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.get('/api/leaderboards', (_req, res) => {
    res.json(getLeaderboards())
  })

  /**
   * Auth passthrough for the Bloxity SDK.
   *
   * The frontend will POST `{ token, user }` here from
   * `Legion.SDK.auth.authenticateWithServer('/api/legion-auth')`.
   *
   * NOTE: not wired up on the frontend yet. The game currently keys saves by the
   * Bloxity user id the client reports when joining the room (WorldRoom.onJoin).
   * When you wire this, call `authenticateWithServer` from
   * `client/src/bloxity/BloxityProvider.jsx` inside the `onUserChanged` handler, right
   * after a non-null user arrives, and pass the returned accessToken to the room join.
   */
  app.post('/api/legion-auth', (req, res) => {
    console.log('[legion-auth] payload:', JSON.stringify(req.body, null, 2))

    // TODO: verify the Bloxity JWT here before trusting req.body.user.
    // Until that happens `req.body.user` is attacker-controlled — anyone can POST any
    // legionId they like. Verify `req.body.token` against Bloxity's public key /
    // introspection endpoint and derive the user from the *verified* claims, not from
    // the body.

    res.json({
      accessToken: 'stub',
      user: { legionId: req.body.user?._id },
    })
  })

  /**
   * Webhook for future Bux purchases.
   * Responds 200 immediately — the platform will retry on anything else, so do the
   * real work asynchronously rather than holding the response open.
   * (This game sells nothing for Bux; kept so the platform's webhook stays valid.)
   */
  app.post('/api/legion-webhook', (req, res) => {
    console.log('[legion-webhook] payload:', JSON.stringify(req.body, null, 2))

    // TODO: verify x-legion-webhook-secret header, dedupe by transactionId, grant the item.

    res.sendStatus(200)
  })

  // Production: serve the built client from the same origin as the game server.
  if (fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST, { maxAge: '1h', index: 'index.html' }))
  }
}
