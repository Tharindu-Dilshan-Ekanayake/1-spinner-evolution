import { create } from 'zustand'

/**
 * Graphics quality presets. Every visual feature checks the active preset before
 * rendering (see PRESETS for what each level allows).
 *
 * Auto mode starts from a hardware guess and <PerformanceMonitor> drops one level
 * whenever the frame rate falls below ~45 FPS. A manual choice in Settings turns
 * auto mode off.
 */

export const PRESETS = {
  LOW: {
    // The frame-rate savers stay off (shadows, particles, glows, fewer avatars, 1x
    // resolution on phones); the cheap things that make a scene look sharp stay on:
    // MSAA (almost free on phone GPUs), 512px studs, a little supersampling on desktop.
    dpr: typeof navigator !== 'undefined' && isMobileDevice() ? 1 : [1, 1.25],
    shadows: false,
    shadowMapSize: 0,
    particles: false,
    maxParticles: 0,
    viewDistance: 110,
    clouds: 3,
    remoteAvatars: 3,
    textureSize: 512,
    // Sign and board text atlases: the phone texture budget is 512px.
    signAtlas: 512,
    decor: 0.4,
    glow: false,
    // Fire / lightning on spinners (spinnerElement.js): flames and arcs per spinner, 0-3.
    // A phone gets the light version; it's a handful of sprites in the one shared batch.
    elements: 1,
    petsPerRemote: 3,
    antialias: true,
    // Spinners further than this draw as a cheap puck (keeps a full team under the
    // 100k-triangle phone budget).
    spinnerLod: 24,
    champions: 1,
  },
  MEDIUM: {
    dpr: [1, 1.5],
    shadows: true,
    shadowMapSize: 1024,
    particles: true,
    maxParticles: 160,
    viewDistance: 170,
    clouds: 10,
    remoteAvatars: 6,
    textureSize: 512,
    signAtlas: 1024,
    decor: 0.75,
    glow: true,
    elements: 2,
    petsPerRemote: 6,
    antialias: true,
    spinnerLod: 36,
    champions: 2,
  },
  HIGH: {
    dpr: [1, 2],
    shadows: true,
    // Capped at the desktop texture budget (1024px).
    shadowMapSize: 1024,
    particles: true,
    maxParticles: 320,
    viewDistance: 260,
    clouds: 18,
    remoteAvatars: 10,
    textureSize: 512,
    signAtlas: 1024,
    decor: 1,
    glow: true,
    elements: 3,
    petsPerRemote: 11,
    antialias: true,
    spinnerLod: 48,
    champions: 3,
  },
}

const ORDER = ['LOW', 'MEDIUM', 'HIGH']
const STORAGE_KEY = 'spinner_quality'

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1
}

export const isMobile = isMobileDevice

function detect() {
  const cores = navigator.hardwareConcurrency || 4
  if (isMobile() || cores <= 4) return 'LOW'
  if (cores <= 8) return 'MEDIUM'
  return 'HIGH'
}

function loadSaved() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (raw && ORDER.includes(raw.preset)) return raw
  } catch {
    // Private mode or corrupt value: fall back to auto.
  }
  return null
}

const saved = loadSaved()

export const useQualityStore = create((set, get) => ({
  preset: saved && !saved.auto ? saved.preset : detect(),
  auto: saved ? saved.auto : true,

  /** Manual choice from Settings. */
  choose(preset) {
    set({ preset, auto: false })
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ preset, auto: false }))
    } catch {
      // ignore
    }
  },

  enableAuto() {
    set({ auto: true, preset: detect() })
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ auto: true }))
    } catch {
      // ignore
    }
  },

  /** Called by <PerformanceMonitor onDecline>. */
  drop() {
    const { preset, auto } = get()
    if (!auto) return
    const i = ORDER.indexOf(preset)
    if (i > 0) set({ preset: ORDER[i - 1] })
  },
}))

/** Settings of the active preset, for non-React code. */
export const quality = () => PRESETS[useQualityStore.getState().preset]
export const useQuality = () => PRESETS[useQualityStore((s) => s.preset)]
