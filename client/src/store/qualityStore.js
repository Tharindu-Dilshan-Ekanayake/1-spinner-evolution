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
    dpr: 1,
    shadows: false,
    shadowMapSize: 0,
    particles: false,
    maxParticles: 0,
    viewDistance: 95,
    clouds: 0,
    remoteAvatars: 3,
    textureSize: 256,
    decor: 0.4,
    glow: false,
    petsPerRemote: 3,
    antialias: false,
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
    decor: 0.75,
    glow: true,
    petsPerRemote: 6,
    antialias: true,
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
    decor: 1,
    glow: true,
    petsPerRemote: 11,
    antialias: true,
  },
}

const ORDER = ['LOW', 'MEDIUM', 'HIGH']
const STORAGE_KEY = 'spinner_quality'

export function isMobile() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1
}

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
