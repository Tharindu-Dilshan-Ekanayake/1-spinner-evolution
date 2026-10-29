import { allProfiles, topPlayers, usesMongo } from './store.js'

/**
 * Global top-10 boards for the lobby (Most Playtime / Most Rebirths / Most Wins).
 * Recomputed at most every REFRESH_MS from every save, then shared by all rooms. With
 * MongoDB the rows come from the database (every pod's players, not just this pod's).
 */

const REFRESH_MS = 30000
const TOP = 10

let cache = { playtime: [], rebirths: [], wins: [], updatedAt: 0 }
let cachedAt = 0
let refreshing = false

async function refreshFromMongo(now) {
  if (refreshing) return
  refreshing = true
  try {
    const [playtime, rebirths, wins] = await Promise.all([
      topPlayers('playtime', TOP),
      topPlayers('rebirths', TOP),
      topPlayers('wins', TOP),
    ])
    cache = { playtime, rebirths, wins, updatedAt: now }
    cachedAt = now
  } catch (err) {
    console.error('[leaderboard] refresh failed', err)
  } finally {
    refreshing = false
  }
}

export function getLeaderboards(now = Date.now()) {
  if (now - cachedAt < REFRESH_MS && cachedAt) return cache
  if (usesMongo()) {
    // Answer with the last boards now; the fresh ones arrive for the next request.
    refreshFromMongo(now)
    return cache
  }
  const rows = [...allProfiles()]
  const top = (value) =>
    rows
      .map((p) => ({ name: p.name, value: value(p) }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, TOP)

  cache = {
    playtime: top((p) => Math.floor(p.stats?.playtime || 0)),
    rebirths: top((p) => p.rebirths || 0),
    wins: top((p) => Math.floor(p.stats?.totalWins || 0)),
    updatedAt: now,
  }
  cachedAt = now
  return cache
}
