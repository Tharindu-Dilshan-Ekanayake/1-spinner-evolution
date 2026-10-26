import { allProfiles } from './store.js'

/**
 * Global top-10 boards for the lobby (Most Playtime / Most Rebirths / Most Wins).
 * Recomputed at most every REFRESH_MS from every save, then shared by all rooms.
 */

const REFRESH_MS = 30000
const TOP = 10

let cache = null
let cachedAt = 0

export function getLeaderboards(now = Date.now()) {
  if (cache && now - cachedAt < REFRESH_MS) return cache
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
