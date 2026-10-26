import { quality } from '../../store/qualityStore'
import { SPRITE, fxBatch } from './fxBatch'

/**
 * Pooled particles and timed effects, drawn through fxBatch.
 *
 * Particles live in fixed typed arrays (swap-remove on death): nothing is allocated
 * while the game runs. The LOW preset disables particles entirely; the timed effects
 * (beams, shockwave rings, flashes) are single quads and stay on every preset.
 */

const MAX = 400
const px = new Float32Array(MAX)
const py = new Float32Array(MAX)
const pz = new Float32Array(MAX)
const vx = new Float32Array(MAX)
const vy = new Float32Array(MAX)
const vz = new Float32Array(MAX)
const life = new Float32Array(MAX)
const maxLife = new Float32Array(MAX)
const size = new Float32Array(MAX)
const grow = new Float32Array(MAX)
const cr = new Float32Array(MAX)
const cg = new Float32Array(MAX)
const cb = new Float32Array(MAX)
const sprite = new Uint8Array(MAX)
const gravity = new Float32Array(MAX)
let count = 0

/**
 * @param {object} o  { speed, up, life, size, r, g, b, sprite, gravity, grow }
 */
export function emit(x, y, z, n, o) {
  const q = quality()
  if (!q.particles) return
  const cap = Math.min(MAX, q.maxParticles)
  for (let k = 0; k < n && count < cap; k += 1) {
    const i = count
    count += 1
    const a = Math.random() * Math.PI * 2
    const sp = o.speed * (0.4 + Math.random() * 0.6)
    px[i] = x
    py[i] = y
    pz[i] = z
    vx[i] = Math.cos(a) * sp
    vz[i] = Math.sin(a) * sp
    vy[i] = (o.up || 0) * (0.5 + Math.random() * 0.8)
    maxLife[i] = life[i] = (o.life || 0.6) * (0.7 + Math.random() * 0.6)
    size[i] = (o.size || 0.3) * (0.7 + Math.random() * 0.6)
    grow[i] = o.grow || 0
    cr[i] = o.r ?? 1
    cg[i] = o.g ?? 0.8
    cb[i] = o.b ?? 0.3
    sprite[i] = o.sprite ?? SPRITE.glow
    gravity[i] = o.gravity ?? 9
  }
}

function updateParticles(dt) {
  let i = 0
  while (i < count) {
    life[i] -= dt
    if (life[i] <= 0) {
      // Swap-remove.
      const last = count - 1
      px[i] = px[last]
      py[i] = py[last]
      pz[i] = pz[last]
      vx[i] = vx[last]
      vy[i] = vy[last]
      vz[i] = vz[last]
      life[i] = life[last]
      maxLife[i] = maxLife[last]
      size[i] = size[last]
      grow[i] = grow[last]
      cr[i] = cr[last]
      cg[i] = cg[last]
      cb[i] = cb[last]
      sprite[i] = sprite[last]
      gravity[i] = gravity[last]
      count -= 1
      continue
    }
    vy[i] -= gravity[i] * dt
    px[i] += vx[i] * dt
    py[i] += vy[i] * dt
    pz[i] += vz[i] * dt
    if (py[i] < 0.05) {
      py[i] = 0.05
      vy[i] *= -0.3
    }
    const t = life[i] / maxLife[i]
    fxBatch.push(px[i], py[i], pz[i], size[i] * (1 + grow[i] * (1 - t)), cr[i], cg[i], cb[i], t, sprite[i])
    i += 1
  }
}

/* ---------------------------------------------------------------------------
 * Timed effects
 * ------------------------------------------------------------------------- */

const EFFECTS = 40
const effects = Array.from({ length: EFFECTS }, () => ({
  active: false,
  type: '',
  x: 0,
  y: 0,
  z: 0,
  t: 0,
  dur: 1,
  r: 1,
  g: 1,
  b: 1,
  size: 1,
}))

export function spawnEffect(type, x, y, z, { dur = 1, r = 1, g = 1, b = 1, size = 1 } = {}) {
  let e = effects[0]
  for (let i = 0; i < EFFECTS; i += 1) {
    if (!effects[i].active) {
      e = effects[i]
      break
    }
  }
  e.active = true
  e.type = type
  e.x = x
  e.y = y
  e.z = z
  e.t = 0
  e.dur = dur
  e.r = r
  e.g = g
  e.b = b
  e.size = size
}

function updateEffects(dt) {
  for (let i = 0; i < EFFECTS; i += 1) {
    const e = effects[i]
    if (!e.active) continue
    e.t += dt
    const k = e.t / e.dur
    if (k >= 1) {
      e.active = false
      continue
    }
    const fade = 1 - k
    if (e.type === 'beam') {
      // A tall glowing column that thins out.
      const w = e.size * (1 - k * 0.6)
      fxBatch.push(e.x, e.y + 5, e.z, w, e.r, e.g, e.b, fade * 0.9, SPRITE.glow, false, 0, 7)
      fxBatch.push(e.x, e.y + 5, e.z, w * 0.45, 1, 1, 1, fade, SPRITE.glow, false, 0, 7)
    } else if (e.type === 'ring') {
      fxBatch.push(e.x, e.y + 0.08, e.z, e.size * (0.2 + k), e.r, e.g, e.b, fade, SPRITE.ring, true)
    } else if (e.type === 'flash') {
      fxBatch.push(e.x, e.y, e.z, e.size * (0.6 + k * 0.6), e.r, e.g, e.b, fade, SPRITE.glow)
    }
  }
}

export function updateFx(dt) {
  updateEffects(dt)
  updateParticles(dt)
}

/* ---------------------------------------------------------------------------
 * Presets used across the game
 * ------------------------------------------------------------------------- */

export const fx = {
  hit(x, y, z, big = false) {
    spawnEffect('flash', x, y, z, { dur: 0.18, r: 1, g: 0.85, b: 0.4, size: big ? 2.6 : 1.5 })
    emit(x, y, z, big ? 14 : 7, { speed: 7, up: 4, life: 0.35, size: 0.22, r: 1, g: 0.65, b: 0.15, sprite: SPRITE.glow, gravity: 12 })
  },
  levelUp(x, y, z) {
    spawnEffect('beam', x, y, z, { dur: 1.4, r: 1, g: 0.9, b: 0.25, size: 2.4 })
    spawnEffect('ring', x, y, z, { dur: 0.8, r: 1, g: 0.95, b: 0.4, size: 7 })
    emit(x, y + 1, z, 24, { speed: 3, up: 7, life: 1, size: 0.35, r: 1, g: 0.92, b: 0.3, sprite: SPRITE.sparkle, gravity: 4 })
  },
  rebirth(x, y, z) {
    spawnEffect('beam', x, y, z, { dur: 2, r: 0.8, g: 0.35, b: 1, size: 3.4 })
    spawnEffect('ring', x, y, z, { dur: 1.1, r: 0.75, g: 0.4, b: 1, size: 14 })
    spawnEffect('ring', x, y, z, { dur: 1.6, r: 0.4, g: 0.85, b: 1, size: 22 })
    emit(x, y + 1, z, 50, { speed: 6, up: 9, life: 1.4, size: 0.4, r: 0.85, g: 0.55, b: 1, sprite: SPRITE.sparkle, gravity: 5 })
  },
  poof(x, y, z) {
    spawnEffect('ring', x, y, z, { dur: 0.5, r: 1, g: 1, b: 1, size: 4 })
    spawnEffect('flash', x, y + 0.5, z, { dur: 0.3, r: 1, g: 0.9, b: 0.8, size: 3 })
    emit(x, y + 0.4, z, 16, { speed: 3.5, up: 3, life: 0.7, size: 0.9, r: 0.9, g: 0.9, b: 0.95, sprite: SPRITE.puff, gravity: -1, grow: 1.2 })
  },
  pickup(x, y, z) {
    spawnEffect('flash', x, y, z, { dur: 0.4, r: 1, g: 0.6, b: 0.1, size: 3 })
    emit(x, y, z, 14, { speed: 2.5, up: 5, life: 0.8, size: 0.3, r: 1, g: 0.6, b: 0.1, sprite: SPRITE.sparkle, gravity: 6 })
  },
  sparkle(x, y, z, r = 1, g = 0.9, b = 0.4) {
    emit(x, y, z, 2, { speed: 1.2, up: 2, life: 0.6, size: 0.25, r, g, b, sprite: SPRITE.sparkle, gravity: 1 })
  },
}
