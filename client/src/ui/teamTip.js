import { create } from 'zustand'

/**
 * The "See your team!" tip that points at the Spinners button until a new player has
 * opened it once (remembered on this device): many first-time players never found out
 * that their spinners are a team they can look at and change.
 */

const KEY = 'spinner_team_seen'

function read() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export const useTeamTip = create(() => ({ seen: read() }))

export function markTeamSeen() {
  if (useTeamTip.getState().seen) return
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // Private mode: the tip just shows again next visit.
  }
  useTeamTip.setState({ seen: true })
}
