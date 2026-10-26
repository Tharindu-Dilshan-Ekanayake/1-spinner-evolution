import { create } from 'zustand'

/**
 * One wall clock for every countdown in the HUD (gifts, potions), ticking once a
 * second. Components read `now` from here instead of calling Date.now() while
 * rendering, and share a single timer.
 */
export const useClock = create(() => ({ now: Date.now() }))

setInterval(() => useClock.setState({ now: Date.now() }), 1000)

export const useNow = () => useClock((s) => s.now)
