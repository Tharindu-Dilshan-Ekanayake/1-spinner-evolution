import { SPINNERS } from '@shared'

import { SPRITE, fxBatch, shadowBatch } from '../render/fxBatch'

/**
 * Fire and lightning on the spinners, like the original's fights: a spinner of fire
 * spins in a swirl of trailing flames, an electric one crackles with arcs of lightning.
 *
 * Both are immediate-mode fx sprites (one shared draw call, nothing allocated per
 * frame). `detail` comes from the quality preset (1 on phones, 3 on desktop): how many
 * flames / arcs each spinner gets. `power` (0-1) fades the effect in and out.
 */

export const FIRE = 1
export const LIGHTNING = 2

/** Spinners whose element isn't what their colours say. */
const OVERRIDE = {
  thunder_god: LIGHTNING,
  storm_blade: LIGHTNING,
  cyber_disc: LIGHTNING,
  astral_blade: LIGHTNING,
  prism_core: LIGHTNING,
  infinity: LIGHTNING,
  shadow_reaper: FIRE,
  omega: FIRE,
  royal_star: FIRE,
  golden_emperor: FIRE,
  seraph: FIRE,
  toxic_saw: 0,
  neon_viper: 0,
}

const cache = new Map()

function hueOf(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d < 0.12) return -1
  let h
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return ((h * 60) + 360) % 360
}

/** FIRE, LIGHTNING or 0 (none) for a spinner id: reds, oranges and yellows burn; blues, cyans and purples spark. */
export function elementOf(id) {
  let e = cache.get(id)
  if (e !== undefined) return e
  const def = SPINNERS[id]
  if (!def) e = 0
  else if (id in OVERRIDE) e = OVERRIDE[id]
  else {
    const h = hueOf(def.a)
    if (h < 0) e = 0
    else if (h < 55 || h >= 340) e = FIRE
    else if (h >= 170 && h < 290) e = LIGHTNING
    else e = 0
  }
  cache.set(id, e)
  return e
}

/** A repeatable "random" in [0, 1) from a number (so flickers hold for a few frames). */
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

/**
 * A crown of flames swirling round the spinner: upright tongues of fire (a lumpy flame
 * sprite stretched tall) standing round its rim and chasing each other in a circle. Each
 * tongue is three layers: a red body, an orange middle and a yellow-white core, so it
 * reads as a real flame; the red and orange are drawn with normal blending, so they stay
 * solid on a light floor.
 */
function pushFire(x, y, z, r, t, phase, power, detail) {
  const n = detail === 1 ? 5 : detail === 2 ? 7 : 9
  const turn = t * 5.5 + phase
  for (let k = 0; k < n; k += 1) {
    const a = turn + (k / n) * Math.PI * 2
    const rad = r * 1.15
    // Each tongue flickers on its own beat; the ones at the head of the swirl are tallest.
    const flick = 0.75 + 0.25 * Math.sin(t * 19 + k * 2.3 + phase)
    const lead = 0.6 + 0.4 * (1 - k / n)
    const w = r * 1.6 * lead
    const tall = 1.9 * flick
    const cx = x + Math.cos(a) * rad
    const cz = z + Math.sin(a) * rad
    const cy = y + 0.1 + w * tall * 0.5
    // Lean along the swirl, so the flames stream behind the head.
    const lean = -0.35
    shadowBatch.push(cx, cy, cz, w, 0.95, 0.14, 0.03, power * 0.9, SPRITE.puff, false, lean, tall)
    shadowBatch.push(cx, cy - w * 0.1, cz, w * 0.72, 1, 0.5, 0.05, power * 0.95, SPRITE.puff, false, lean, tall * 0.9)
    fxBatch.push(cx, cy - w * 0.2, cz, w * 0.4, 1, 0.92, 0.5, power * 0.85, SPRITE.puff, false, lean, tall * 0.8)
  }
  // Embers' glow on the floor: a faint red ring, not a bright blob.
  shadowBatch.push(x, y + 0.06, z, r * 3, 1, 0.3, 0.05, power * 0.3, SPRITE.ring, true, t * 2)
}

/**
 * One straight piece of a bolt, lying along the floor from (ax, az) to (bx, bz) at height
 * y: a blue line with a thin white-hot core, both with soft ends. `width` is the blue
 * line's thickness.
 */
function pushSegment(ax, az, bx, bz, y, width, power) {
  const dx = bx - ax
  const dz = bz - az
  const len = Math.hypot(dx, dz) + 1e-4
  const mx = (ax + bx) * 0.5
  const mz = (az + bz) * 0.5
  // The quad's long axis ends up along (dx, dz) when rotated by atan2(-dx, -dz).
  const rot = Math.atan2(-dx, -dz)
  // The soft ends overlap into the next piece, so the bolt reads as one jagged line.
  const stretch = (len * 1.35) / width
  shadowBatch.push(mx, y, mz, width, 0.08, 0.38, 1, power, SPRITE.glow, true, rot, stretch)
  shadowBatch.push(mx, y + 0.01, mz, width * 0.55, 0.45, 0.8, 1, power, SPRITE.glow, true, rot, stretch)
  fxBatch.push(mx, y + 0.02, mz, width * 0.3, 1, 1, 1, power, SPRITE.glow, true, rot, stretch)
}

/**
 * Forked lightning crackling off the spinner: jagged bolts that jump to a new direction
 * every few frames, each a continuous zig-zag line (blue with a white-hot core) from the
 * spinner's rim outwards, with a short branch splitting off one of them.
 */
function pushLightning(x, y, z, r, t, phase, power, detail) {
  const step = Math.floor(t * 14 + phase * 5)
  // Whole-bolt flicker: it blinks off for a frame now and then, like the real thing.
  const on = hash(step + 9) > 0.12 ? 1 : 0.35
  const py = y + 0.35
  const width = r * 0.75
  for (let j = 0; j < detail; j += 1) {
    const seed = step * 7 + j * 131 + phase * 13
    const dir = hash(seed) * Math.PI * 2 + (j * Math.PI * 2) / detail
    const len = r * (2.6 + hash(seed + 1) * 1.6)
    const dx = Math.cos(dir)
    const dz = Math.sin(dir)
    let ax = x + dx * r * 0.8
    let az = z + dz * r * 0.8
    let forkX = 0
    let forkZ = 0
    for (let i = 1; i <= 6; i += 1) {
      const f = i / 6
      // A zig-zag: each point is pushed off the straight line, alternately each way.
      const side = (hash(seed + i * 3) - 0.5) * r * 1.5 * (1 - f * 0.4)
      const bx = x + dx * (r * 0.8 + len * f) - dz * side
      const bz = z + dz * (r * 0.8 + len * f) + dx * side
      pushSegment(ax, az, bx, bz, py, width * (1 - f * 0.35), power * on)
      if (i === 3) {
        forkX = bx
        forkZ = bz
      }
      ax = bx
      az = bz
    }
    // A short branch off the middle of the first bolt.
    if (j === 0) {
      const fork = dir + (hash(seed + 2) > 0.5 ? 0.8 : -0.8)
      const mx = forkX + Math.cos(fork) * len * 0.35
      const mz = forkZ + Math.sin(fork) * len * 0.35
      pushSegment(forkX, forkZ, (forkX + mx) * 0.5 + (hash(seed + 4) - 0.5) * r * 0.5, (forkZ + mz) * 0.5 + (hash(seed + 5) - 0.5) * r * 0.5, py, width * 0.6, power * on)
      pushSegment((forkX + mx) * 0.5, (forkZ + mz) * 0.5, mx, mz, py, width * 0.45, power * on)
    }
  }
  // A thin blue ring of charge round the spinner (no soft blob).
  shadowBatch.push(x, y + 0.08, z, r * 2.6, 0.3, 0.6, 1, power * 0.5, SPRITE.ring, true, t * 4)
}

/**
 * Draws one spinner's element effect. `r` is the spinner's radius in world units, `t` is
 * in seconds, `phase` offsets the flicker so a team doesn't pulse in step.
 */
export function pushElement(kind, x, y, z, r, t, phase, power, detail) {
  if (power <= 0.02 || detail <= 0) return
  if (kind === FIRE) pushFire(x, y, z, r, t, phase, power, detail)
  else if (kind === LIGHTNING) pushLightning(x, y, z, r, t, phase, power, detail)
}

/** The colour of an element's hit flash and sparks: [r, g, b]. */
export function elementColor(kind) {
  return kind === FIRE ? FIRE_RGB : kind === LIGHTNING ? LIGHTNING_RGB : null
}
const FIRE_RGB = [1, 0.5, 0.1]
const LIGHTNING_RGB = [0.45, 0.8, 1]
