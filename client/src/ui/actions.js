import { sfx } from '../audio/sfx'
import { send } from '../net/connection'

/** Sends an action to the server with a click sound. */
export function act(type, payload) {
  sfx.click()
  send(type, payload)
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

/**
 * Seconds played today, counted forward locally from the last server update so the
 * gift timers tick every second.
 */
export function giftSeconds(profile, now, giftsAt) {
  return (profile.gifts?.seconds || 0) + Math.max(0, (now - (giftsAt || now)) / 1000)
}
