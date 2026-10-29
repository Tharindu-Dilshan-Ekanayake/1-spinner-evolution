/**
 * The latest Boxity chat line of each player, shown above their head for a few
 * seconds (Boxity draws the chat box itself; see platform.js). Keyed by Boxity account
 * id, or SELF for our own messages; drawn by LocalPlayer and RemotePlayers.
 */

export const SELF = 'self'

const lines = new Map()

/** A newer message from the same player replaces the old one. */
export function showBubble(key, text, seconds) {
  if (!key || !text) return
  lines.set(key, { text, until: performance.now() + seconds * 1000 })
}

/** The line to draw above this player right now, or null. */
export function bubbleFor(key, now = performance.now()) {
  if (!key) return null
  const line = lines.get(key)
  if (!line) return null
  if (now > line.until) {
    lines.delete(key)
    return null
  }
  return line.text
}
