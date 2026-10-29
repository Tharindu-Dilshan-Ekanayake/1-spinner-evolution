/**
 * What the game tells the Boxity platform, shared by the client (which declares the
 * boards so Boxity shows its trophy button) and the server (which submits the scores).
 */

/**
 * The game's Boxity leaderboards. The FIRST declaration creates a board; later edits
 * here are ignored by Boxity (change them in the dashboard), so ids are permanent.
 * Scores are lifetime totals that only grow, so 'best' keeps each player's latest.
 */
export const BOXITY_BOARDS = [
  { id: 'wins', label: 'Most Wins', order: 'desc', mode: 'best', format: 'compact', reset: 'none' },
  { id: 'rebirths', label: 'Most Rebirths', order: 'desc', mode: 'best', format: 'number', reset: 'none' },
  { id: 'playtime', label: 'Minutes Played', order: 'desc', mode: 'best', format: 'number', reset: 'none' },
]

/** A profile's score on each board (playtime is stored in seconds, shown in minutes). */
export function boardScores(profile) {
  return {
    wins: Math.floor(profile.stats?.totalWins || 0),
    rebirths: profile.rebirths || 0,
    playtime: Math.floor((profile.stats?.playtime || 0) / 60),
  }
}

/** Boxity emote ids are 24-character catalogue ids. */
export const EMOTE_ID = /^[a-f0-9]{24}$/i
