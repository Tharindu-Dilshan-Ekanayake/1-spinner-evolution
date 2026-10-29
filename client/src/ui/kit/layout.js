import { useSyncExternalStore } from 'react'

/**
 * Which HUD arrangement fits this screen, and how big a reference pixel is. All three
 * follow the studio's +1 Slide Downhill: stats and menu tiles down the left, passes on
 * the right, gift timer top-centre, level bar at the bottom - only spacing changes.
 *
 *   wide  - desktops, laptops, tablets in landscape
 *   short - phones in landscape (under 560px tall): tighter left column
 *   tall  - phones and tablets in portrait: the gift timer drops below the top buttons
 *
 * The scale is the 1920x1080 reference fitted to the screen (at 82%, so the game shows
 * more), floored like Slide Downhill so buttons stay big enough to tap on a phone. It is written to the --px CSS
 * variable, which every HUD size (u()) reads.
 */

function measure() {
  const w = window.innerWidth
  const h = window.innerHeight
  // 82% of a full-screen fit: the HUD frames the game instead of covering it. Phones
  // sit on the floor value, where buttons are still comfortably tappable.
  const px = Math.min(1.2, Math.max(0.42, Math.min(w / 1920, h / 1080) * 0.82))
  if (w / h < 1.25) return { mode: 'tall', px }
  return { mode: h < 560 ? 'short' : 'wide', px }
}

let current = typeof window === 'undefined' ? { mode: 'wide', px: 1 } : measure()
const listeners = new Set()

function apply() {
  document.documentElement.style.setProperty('--px', `${current.px}px`)
}

if (typeof window !== 'undefined') {
  apply()
  window.addEventListener('resize', () => {
    const next = measure()
    if (next.mode === current.mode && Math.abs(next.px - current.px) < 0.002) return
    current = next
    apply()
    for (const fn of listeners) fn()
  })
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** 'wide' | 'short' | 'tall' - re-renders when the screen changes shape. */
export function useHudMode() {
  return useSyncExternalStore(subscribe, () => current.mode)
}
