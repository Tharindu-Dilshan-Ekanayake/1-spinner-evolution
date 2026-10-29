import { BOXITY_BOARDS } from '../../shared/index.js'

/**
 * Everything the server says to Boxity, in one place.
 *
 * Boxity hosting injects BLOXITY_* on every deploy, per environment (prod, stage or
 * local); the prod values below are only a fallback for a variable that is missing.
 * Build every Boxity URL from these - never write a Boxity host name anywhere else.
 */

const trim = (url) => String(url).replace(/\/+$/, '')
const read = (name, fallback) => trim(process.env[name] || fallback)

export const BLOXITY = {
  env: process.env.BLOXITY_ENV || 'prod',
  apiUrl: read('BLOXITY_API_URL', 'https://api.bloxity.io'),
  matchmakerUrl: read('BLOXITY_MATCHMAKER_URL', 'https://play.bloxity.io'),
  portalUrl: read('BLOXITY_PORTAL_URL', 'https://bloxity.io'),
  staticUrl: read('BLOXITY_STATIC_URL', 'https://static.bloxity.io'),
  /** Set by Boxity hosting; without them (local dev) nothing is reported. */
  gameId: process.env.BLOXITY_GAME_ID || '',
  reportToken: process.env.BLOXITY_REPORT_TOKEN || '',
  /** The game's slug, for token checks; the client's own slug is used when unset. */
  gameSlug: process.env.BLOXITY_GAME_SLUG || '',
}

const TIMEOUT_MS = 5000

/**
 * Asks Boxity who a player's token belongs to. Never throws: anything but a clear
 * `valid: true` (bad token, Boxity unreachable, local dev offline) returns null and
 * the player plays as a guest.
 *
 * @returns {Promise<{ userId: string, carriedFrom: string[] } | null>}
 *   carriedFrom: Boxity guest ids this browser played as before signing in (newest
 *   first, up to 5), whose progress may move into an account that has none.
 */
export async function verifyPlayer(token, gameSlug) {
  if (!token) return null
  try {
    const res = await fetch(`${BLOXITY.apiUrl}/v1/auth/game-token/verify`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ gameSlug }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return null
    const body = await res.json()
    const id = body?.valid && (body.user?._id || body.user?.id)
    if (!id) return null
    const carriedFrom = Array.isArray(body.carriedFrom) ? body.carriedFrom.map(String).slice(0, 5) : []
    return { userId: String(id), carriedFrom }
  } catch (err) {
    console.warn('[bloxity] token check failed:', err?.message || err)
    return null
  }
}

/* ---------------------------------------------------------------------------
 * Leaderboards: scores come from the server's own state, batched
 * ------------------------------------------------------------------------- */

const REPORT_EVERY_MS = 20000
const MAX_PER_CALL = 200
/** "legion_<id>" -> { board: score }; the latest value wins. */
const pending = new Map()

/** Queues a verified Boxity player's scores for the next report. */
export function queueScores(userId, scores) {
  if (!BLOXITY.reportToken || !BLOXITY.gameId || !userId) return
  // Boxity ids may carry a "#m..." mode suffix; the board wants the bare identity.
  pending.set(`legion_${String(userId).split('#')[0]}`, scores)
}

async function report() {
  if (!pending.size) return
  const scores = []
  for (const [userId, boards] of pending) {
    for (const [board, score] of Object.entries(boards)) scores.push({ board, userId, score })
  }
  pending.clear()
  for (let i = 0; i < scores.length; i += MAX_PER_CALL) {
    try {
      const res = await fetch(`${BLOXITY.apiUrl}/v1/leaderboards/hosted/${encodeURIComponent(BLOXITY.gameId)}/report`, {
        method: 'POST',
        headers: { authorization: `Bearer ${BLOXITY.reportToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ boards: BOXITY_BOARDS, scores: scores.slice(i, i + MAX_PER_CALL) }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) console.warn('[bloxity] leaderboard report failed:', res.status, body?.error || '')
      else if (body?.dropped && Object.values(body.dropped).some(Boolean)) console.warn('[bloxity] leaderboard scores dropped:', body.dropped)
    } catch (err) {
      console.warn('[bloxity] leaderboard report failed:', err?.message || err)
    }
  }
}

/** Starts the periodic report (a no-op without BLOXITY_REPORT_TOKEN, i.e. local dev). */
export function startLeaderboardReports() {
  if (!BLOXITY.reportToken || !BLOXITY.gameId) return
  setInterval(() => {
    report().catch(() => {})
  }, REPORT_EVERY_MS).unref?.()
}

/** Sends whatever is queued now (round end, shutdown). */
export const flushScores = () => report().catch(() => {})
