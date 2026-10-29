/**
 * Shared WebAudio graph: master -> { sfx, music }.
 *
 * Browsers only allow audio after a user gesture, so the context is created on the
 * first tap/click/key (see unlockAudioOnFirstGesture). Every sound in the game is
 * synthesised (sfx.js, music.js): zero audio files to download.
 */

const STORAGE_KEY = 'spinner_audio'

let ctx = null
let master = null
let sfxBus = null
let musicBus = null
let noiseBuffer = null
const listeners = new Set()

function loadSettings() {
  try {
    return { sfx: 0.8, music: 0.45, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
  } catch {
    return { sfx: 0.8, music: 0.45 }
  }
}

export const audioSettings = loadSettings()

export function setVolume(kind, value) {
  audioSettings[kind] = value
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(audioSettings))
  } catch {
    // ignore
  }
  if (kind === 'sfx' && sfxBus) sfxBus.gain.value = value
  if (kind === 'music' && musicBus) musicBus.gain.value = value * 0.5
}

let beforeMute = null

export const isMuted = () => audioSettings.sfx === 0 && audioSettings.music === 0

/** The HUD's sound button: silences everything, then restores the previous volumes. */
export function toggleMute() {
  if (isMuted()) {
    setVolume('sfx', beforeMute?.sfx || 0.8)
    setVolume('music', beforeMute?.music || 0.45)
  } else {
    beforeMute = { sfx: audioSettings.sfx, music: audioSettings.music }
    setVolume('sfx', 0)
    setVolume('music', 0)
  }
  return isMuted()
}

/** Ad breaks: everything goes quiet until the break ends (volumes are left alone). */
export function setAudioPaused(paused) {
  if (!ctx) return
  if (paused) ctx.suspend().catch(() => {})
  else ctx.resume().catch(() => {})
}

export function getAudio() {
  return ctx ? { ctx, sfx: sfxBus, music: musicBus, noise: noiseBuffer } : null
}

/** Called once audio is available; music starts from here. */
export function onAudioReady(fn) {
  if (ctx) fn()
  else listeners.add(fn)
}

function createContext() {
  if (ctx) return
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return
  ctx = new Ctor()
  master = ctx.createGain()
  master.gain.value = 0.9
  // A gentle limiter so stacked hits never clip.
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -10
  comp.ratio.value = 6
  master.connect(comp).connect(ctx.destination)

  sfxBus = ctx.createGain()
  sfxBus.gain.value = audioSettings.sfx
  sfxBus.connect(master)
  musicBus = ctx.createGain()
  musicBus.gain.value = audioSettings.music * 0.5
  musicBus.connect(master)

  // One second of white noise, reused by every percussive sound.
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1

  for (const fn of listeners) fn()
  listeners.clear()
}

/** Installs one-shot listeners that create/resume the AudioContext on first input. */
export function unlockAudioOnFirstGesture() {
  const unlock = () => {
    createContext()
    if (ctx && ctx.state === 'suspended') ctx.resume()
    if (ctx && ctx.state === 'running') {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('touchend', unlock)
    }
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
  window.addEventListener('touchend', unlock)

  // Tab hidden: pause everything (saves battery on mobile).
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return
    if (document.hidden) ctx.suspend()
    else ctx.resume()
  })
}
