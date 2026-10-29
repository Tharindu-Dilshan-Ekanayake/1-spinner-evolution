import { create } from 'zustand'

/**
 * Everything the HUD shows. Written by network handlers and UI events - never from
 * inside the frame loop (per-frame values live in store/live.js).
 */

let toastId = 0

export const useGameStore = create((set, get) => ({
  /** 'connecting' | 'online' | 'offline' | 'error' */
  status: 'connecting',
  error: null,
  /** True once the loading screen has lifted (the HUD mounts then). */
  playable: false,
  /** A Boxity ad break is running: the game is paused and silent (bloxity/platform.js). */
  adBreak: false,
  /** A moment after that: secondary scenery (labels, leaderboards) builds now. */
  settled: false,

  profile: null,
  /** When profile.gifts.seconds was last received (ms), so timers can count on. */
  giftsAt: 0,
  quest: null,
  daily: null,
  /** Current stage run: { world, cleared, wins } or null. */
  run: null,
  zone: 'lobby',
  leaderboards: null,

  /** Open side panel: null | 'spinners' | 'rebirth' | 'trails' | 'auras' | 'shop' | 'worlds' | 'settings' | 'gifts' */
  panel: null,
  /** What the player is standing next to (updated by the trigger poller, ~10 Hz). */
  nearby: { shopPad: null, ring: null, padHint: null, crystal: false, portal: null, pad: null, returnPad: false, onStages: true },

  /** Battle HUD: { world, stage, line, units, mine, theirs, maxMine, maxTheirs, endAt } */
  battle: null,
  battleResult: null,

  toasts: [],
  /** Queue of reward popups ("+7 WINS! KEEP GOING!") */
  rewards: [],
  /** Wins still flying to the counter (see WinsFlight); the counter shows wins minus these. */
  winsInFlight: 0,
  levelUp: null,
  /** Capsule opening animation: { capsule, results } */
  opening: null,
  /** Session ids of other players in our zone, for React to mount their avatars. */
  remoteIds: [],
  /** Bumped whenever new spinner icons are rendered. */
  iconVersion: 0,
  /** Teleport fade overlay. */
  fading: false,

  setPanel: (panel) => set({ panel: get().panel === panel ? null : panel }),
  closePanel: () => set({ panel: null }),

  toast(text, kind = 'info') {
    const id = ++toastId
    set({ toasts: [...get().toasts.slice(-3), { id, text, kind }] })
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 2600)
  },

  pushReward(entry) {
    const id = ++toastId
    set({ rewards: [...get().rewards.slice(-2), { id, ...entry }] })
    setTimeout(() => set({ rewards: get().rewards.filter((r) => r.id !== id) }), 3200)
  },

  /** Merge the fast-changing stats message into the profile. */
  applyStats(stats) {
    const p = get().profile
    if (!p) return
    set({
      profile: {
        ...p,
        level: stats.level,
        power: stats.power,
        wins: stats.wins,
        rebirths: stats.rebirths,
        stats: { ...p.stats, playtime: stats.playtime },
        gifts: { ...p.gifts, seconds: stats.giftSeconds },
      },
      giftsAt: Date.now(),
    })
  },
}))

/** Non-reactive read for event handlers. */
export const gameState = () => useGameStore.getState()
