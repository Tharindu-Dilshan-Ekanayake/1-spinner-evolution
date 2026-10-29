import { getAudio } from './audio'

/**
 * Synthesised sound effects. Each function is fire-and-forget and silently does
 * nothing until audio has been unlocked.
 *
 * Building blocks: tone() for pitched blips/chords, noise() for percussive hits and
 * whooshes. Rapid-fire sounds (training gains, hits) are rate-limited so a big army
 * doesn't turn into a wall of noise.
 */

const lastPlayed = new Map()

/** True if `key` played less than `ms` ago (and records this play otherwise). */
function throttled(key, ms) {
  const now = performance.now()
  if (now - (lastPlayed.get(key) || 0) < ms) return true
  lastPlayed.set(key, now)
  return false
}

function tone(a, { freq, to = freq, type = 'sine', at = 0, dur = 0.12, vol = 0.3, attack = 0.005 }) {
  const { ctx, sfx } = a
  const t = ctx.currentTime + at
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(sfx)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

function noise(a, { at = 0, dur = 0.15, vol = 0.3, filter = 'bandpass', freq = 2000, to = freq, q = 1 }) {
  const { ctx, sfx, noise: buffer } = a
  const t = ctx.currentTime + at
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.playbackRate.value = 0.8 + Math.random() * 0.4
  const f = ctx.createBiquadFilter()
  f.type = filter
  f.Q.value = q
  f.frequency.setValueAtTime(freq, t)
  if (to !== freq) f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(sfx)
  src.start(t, Math.random() * 0.5)
  src.stop(t + dur + 0.02)
}

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12)

export const sfx = {
  click() {
    const a = getAudio()
    if (!a || throttled('click', 40)) return
    tone(a, { freq: 1100, to: 700, type: 'square', dur: 0.05, vol: 0.08 })
  },

  open() {
    const a = getAudio()
    if (!a) return
    tone(a, { freq: 520, to: 880, type: 'triangle', dur: 0.12, vol: 0.14 })
  },

  close() {
    const a = getAudio()
    if (!a) return
    tone(a, { freq: 700, to: 420, type: 'triangle', dur: 0.1, vol: 0.1 })
  },

  /** Training power pop. */
  gain() {
    const a = getAudio()
    if (!a || throttled('gain', 70)) return
    const f = 900 + Math.random() * 500
    tone(a, { freq: f, to: f * 1.5, type: 'sine', dur: 0.08, vol: 0.06 })
  },

  /** Spinner clash; `big` for boss hits and crits. */
  hit(big = false) {
    const a = getAudio()
    if (!a || throttled('hit', big ? 50 : 65)) return
    noise(a, { dur: big ? 0.22 : 0.12, vol: big ? 0.35 : 0.2, freq: 3200, to: 900, q: 0.8 })
    const ping = 1400 + Math.random() * 900
    tone(a, { freq: ping, to: ping * 0.7, type: 'triangle', dur: big ? 0.25 : 0.14, vol: big ? 0.16 : 0.09 })
    if (big) tone(a, { freq: 120, to: 50, type: 'sine', dur: 0.25, vol: 0.4 })
  },

  levelUp() {
    const a = getAudio()
    if (!a) return
    ;[72, 76, 79, 84].forEach((n, i) =>
      tone(a, { freq: NOTE(n), type: 'square', at: i * 0.08, dur: 0.18, vol: 0.1 }),
    )
    tone(a, { freq: NOTE(88), type: 'sine', at: 0.32, dur: 0.5, vol: 0.12 })
    noise(a, { at: 0.3, dur: 0.5, vol: 0.06, filter: 'highpass', freq: 6000 })
  },

  buy() {
    const a = getAudio()
    if (!a) return
    tone(a, { freq: NOTE(83), type: 'square', dur: 0.08, vol: 0.09 })
    tone(a, { freq: NOTE(88), type: 'square', at: 0.07, dur: 0.22, vol: 0.09 })
  },

  error() {
    const a = getAudio()
    if (!a || throttled('error', 200)) return
    tone(a, { freq: 180, to: 140, type: 'square', dur: 0.18, vol: 0.12 })
  },

  /** Capsule rattle before the reveal. */
  shake() {
    const a = getAudio()
    if (!a) return
    for (let i = 0; i < 6; i += 1) {
      noise(a, { at: i * 0.1, dur: 0.05, vol: 0.18, freq: 1800 + i * 300, q: 3 })
    }
  },

  /** Reveal fanfare; grows with rarity order (0 common .. 6 secret). */
  reveal(order = 0) {
    const a = getAudio()
    if (!a) return
    const chords = [
      [60, 64, 67],
      [62, 66, 69],
      [64, 68, 71],
      [65, 69, 72, 76],
      [67, 71, 74, 79],
      [69, 73, 76, 81, 85],
      [72, 76, 79, 84, 88],
    ]
    const chord = chords[Math.min(order, chords.length - 1)]
    chord.forEach((n, i) => tone(a, { freq: NOTE(n), type: 'triangle', at: i * 0.05, dur: 0.6 + order * 0.1, vol: 0.09 }))
    if (order >= 3) noise(a, { at: 0.05, dur: 0.8, vol: 0.08, filter: 'highpass', freq: 7000 })
    if (order >= 5) tone(a, { freq: NOTE(96), to: NOTE(100), type: 'sine', at: 0.25, dur: 0.8, vol: 0.08 })
  },

  win() {
    const a = getAudio()
    if (!a) return
    ;[67, 72, 76, 79, 84].forEach((n, i) =>
      tone(a, { freq: NOTE(n), type: 'square', at: i * 0.09, dur: 0.25, vol: 0.1 }),
    )
    ;[72, 76, 79].forEach((n) => tone(a, { freq: NOTE(n), type: 'triangle', at: 0.5, dur: 0.9, vol: 0.09 }))
  },

  lose() {
    const a = getAudio()
    if (!a) return
    ;[67, 63, 60, 55].forEach((n, i) =>
      tone(a, { freq: NOTE(n), to: NOTE(n - 1), type: 'sawtooth', at: i * 0.18, dur: 0.3, vol: 0.06 }),
    )
  },

  rebirth() {
    const a = getAudio()
    if (!a) return
    noise(a, { dur: 1.2, vol: 0.25, filter: 'lowpass', freq: 200, to: 8000, q: 2 })
    ;[48, 60, 64, 67, 72, 76, 79].forEach((n, i) =>
      tone(a, { freq: NOTE(n), type: i === 0 ? 'sawtooth' : 'triangle', at: 0.6 + i * 0.04, dur: 1.4, vol: 0.07 }),
    )
  },

  teleport() {
    const a = getAudio()
    if (!a) return
    tone(a, { freq: 200, to: 1600, type: 'sine', dur: 0.45, vol: 0.12 })
    noise(a, { dur: 0.5, vol: 0.1, filter: 'bandpass', freq: 500, to: 5000, q: 2 })
  },

  pickup() {
    const a = getAudio()
    if (!a) return
    tone(a, { freq: NOTE(76), type: 'sine', dur: 0.08, vol: 0.12 })
    tone(a, { freq: NOTE(83), type: 'sine', at: 0.06, dur: 0.14, vol: 0.12 })
  },

  potion() {
    const a = getAudio()
    if (!a) return
    for (let i = 0; i < 5; i += 1) {
      const f = 500 + Math.random() * 700
      tone(a, { freq: f, to: f * 1.8, type: 'sine', at: i * 0.07, dur: 0.08, vol: 0.08 })
    }
  },

  countdown(final = false) {
    const a = getAudio()
    if (!a) return
    tone(a, { freq: final ? NOTE(84) : NOTE(72), type: 'square', dur: final ? 0.35 : 0.12, vol: 0.1 })
  },

  death() {
    const a = getAudio()
    if (!a) return
    noise(a, { dur: 0.35, vol: 0.25, filter: 'lowpass', freq: 2500, to: 200 })
    tone(a, { freq: 300, to: 80, type: 'square', dur: 0.3, vol: 0.06 })
  },

  /** A stage door grinding open. */
  door() {
    const a = getAudio()
    if (!a || throttled('door', 500)) return
    noise(a, { dur: 0.9, vol: 0.22, filter: 'lowpass', freq: 400, to: 120, q: 1.5 })
    tone(a, { freq: 90, to: 60, type: 'sawtooth', dur: 0.8, vol: 0.06 })
    ;[72, 76, 79].forEach((n, i) => tone(a, { freq: NOTE(n), type: 'triangle', at: 0.5 + i * 0.07, dur: 0.3, vol: 0.07 }))
  },

  jump() {
    const a = getAudio()
    if (!a || throttled('jump', 150)) return
    tone(a, { freq: 300, to: 520, type: 'sine', dur: 0.12, vol: 0.06 })
  },
}
