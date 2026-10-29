// Boxity cross-pod room directory: pushes this pod's live rooms to the matchmaker
// every ~2s so "Open Rooms", friend joins and join-by-id work across pods.
// No-op unless deployed by Boxity hosting (BLOXITY_REPORT_TOKEN, MATCHMAKER_REPORT_URL,
// BLOXITY_GAME_ID), so it is safe locally. Call installRoomReporter() after listen().
//
// Plain-JS (ESM) port of the Boxity starter's Server/src/legion-room-reporter.ts, as
// published on docs.bloxity.io (AI prompts > "Show your live rooms"), for Colyseus 0.18.
// Private rooms are never listed by Boxity; the "started" flag is read from room metadata.

import { matchMaker } from '@colyseus/core'

/** @returns {void} */
export function installRoomReporter() {
  const base = process.env.MATCHMAKER_REPORT_URL
  const token = process.env.BLOXITY_REPORT_TOKEN
  const gameId = process.env.BLOXITY_GAME_ID
  const podName = process.env.POD_NAME || process.env.HOSTNAME || ''
  if (!base || !token || !gameId) return

  const url = `${base.replace(/\/$/, '')}/${gameId}/rooms`

  /** @returns {Promise<void>} */
  const tick = async () => {
    try {
      const listings = await matchMaker.query({})
      const rooms = listings.map((listing) => {
        /** @type {Record<string, unknown>} */
        const metadata = listing.metadata || {}
        return {
          colyseusRoomId: listing.roomId,
          name: listing.name || undefined,
          clients: listing.clients ?? 0,
          maxClients: listing.maxClients ?? 0,
          locked: !!listing.locked,
          private: !!listing.private,
          started: !!metadata.started,
          metadata: listing.metadata || undefined,
        }
      })
      const players = rooms.reduce((total, room) => total + (room.clients || 0), 0)
      await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ podName, players, rooms }),
        signal: AbortSignal.timeout(4_000),
      })
    } catch {
      /* best-effort; the directory tolerates gaps */
    }
  }

  setInterval(() => void tick(), 2000).unref()
  void tick()
}
