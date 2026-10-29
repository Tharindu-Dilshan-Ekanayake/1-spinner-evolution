import { Color } from 'three'

import { AURAS, TRAILS } from '@shared'

import { live } from '../../store/live'
import { quality } from '../../store/qualityStore'
import { ORDER, useSystem } from '../loop'
import { overlay } from '../overlay/worldOverlay'
import { spinnerBatch } from '../spinners/spinnerBatch'
import { SPRITE, fxBatch, shadowBatch } from './fxBatch'
import { fx, updateFx } from './particles'

/* ---------------------------------------------------------------------------
 * Cosmetics: auras (glowing rings at the feet) and trails (a stream of glows)
 * ------------------------------------------------------------------------- */

const TRAIL_POINTS = 16
const TRAIL_STEP = 0.045

const colorCache = new Map()
function rgb(hex) {
  let c = colorCache.get(hex)
  if (!c) {
    c = new Color(hex)
    colorCache.set(hex, c)
  }
  return c
}

function ensureTrail(owner) {
  if (!owner.trailPts) {
    owner.trailPts = new Float32Array(TRAIL_POINTS * 3)
    owner.trailHead = 0
    owner.trailTimer = 0
    owner.trailMoving = 0
    for (let i = 0; i < TRAIL_POINTS; i += 1) {
      owner.trailPts[i * 3] = owner.x
      owner.trailPts[i * 3 + 1] = owner.y
      owner.trailPts[i * 3 + 2] = owner.z
    }
  }
}

function drawCosmetics(owner, auraId, trailId, speed, dt, now) {
  const aura = AURAS[auraId]
  if (aura) {
    const c = rgb(aura.color)
    const pulse = 0.75 + Math.sin(now * 0.004) * 0.25
    fxBatch.push(owner.x, owner.y + 0.06, owner.z, 3.4, c.r, c.g, c.b, 0.85 * pulse, SPRITE.ring, true, now * 0.002)
    fxBatch.push(owner.x, owner.y + 1.1, owner.z, 3.2, c.r, c.g, c.b, 0.22 * pulse, SPRITE.glow, false, 0, 1.4)
    if (Math.random() < dt * 4) fx.sparkle(owner.x + (Math.random() - 0.5) * 1.6, owner.y + 0.3, owner.z + (Math.random() - 0.5) * 1.6, c.r, c.g, c.b)
  }

  const trail = TRAILS[trailId]
  if (!trail) return
  ensureTrail(owner)
  owner.trailMoving += ((speed > 1 ? 1 : 0) - owner.trailMoving) * Math.min(1, dt * 5)
  owner.trailTimer += dt
  if (owner.trailTimer >= TRAIL_STEP) {
    owner.trailTimer = 0
    owner.trailHead = (owner.trailHead + 1) % TRAIL_POINTS
    const i = owner.trailHead * 3
    owner.trailPts[i] = owner.x
    owner.trailPts[i + 1] = owner.y + 0.35
    owner.trailPts[i + 2] = owner.z
  }
  if (owner.trailMoving < 0.05) return
  const colors = trail.colors
  for (let k = 0; k < TRAIL_POINTS; k += 1) {
    const idx = ((owner.trailHead - k + TRAIL_POINTS) % TRAIL_POINTS) * 3
    const t = 1 - k / TRAIL_POINTS
    const c = rgb(colors[k % colors.length])
    fxBatch.push(owner.trailPts[idx], owner.trailPts[idx + 1], owner.trailPts[idx + 2], 0.9 * t + 0.2, c.r, c.g, c.b, 0.7 * t * owner.trailMoving, SPRITE.glow)
  }
}

/**
 * Mounts the shared instanced batches (spinners, effects, blob shadows) and runs the
 * per-frame begin/flush around every system that draws into them.
 */
export function Effects() {
  // Labels are requested from several systems; start a fresh set first thing.
  useSystem(-1, () => overlay.begin())

  useSystem(ORDER.batchBegin, (_dt, state) => {
    spinnerBatch.begin(state.camera, quality().spinnerLod)
    fxBatch.begin()
    shadowBatch.begin()
  })

  useSystem(ORDER.fx, (dt) => {
    const queue = live.fx
    for (let i = 0; i < queue.length; i += 1) {
      const e = queue[i]
      if (e.type === 'levelUp') fx.levelUp(e.x, e.y, e.z)
      else if (e.type === 'rebirth') fx.rebirth(e.x, e.y, e.z)
      else if (e.type === 'pickup') fx.pickup(e.x, e.y, e.z)
      else if (e.type === 'poof') fx.poof(e.x, e.y, e.z)
    }
    queue.length = 0

    const now = performance.now()
    const profile = live.profileCosmetics
    if (profile) drawCosmetics(live.player, profile.aura, profile.trail, live.player.speed, dt, now)
    const maxD = quality().viewDistance * 0.6
    const list = live.remoteList
    for (let i = 0; i < list.length; i += 1) {
      const r = list[i]
      if (r.zone !== live.zone) continue
      const dx = r.x - live.player.x
      const dz = r.z - live.player.z
      if (dx * dx + dz * dz > maxD * maxD) continue
      drawCosmetics(r, r.aura, r.trail, r.speed, dt, now)
    }

    updateFx(dt)
  })

  useSystem(ORDER.batchEnd, () => {
    spinnerBatch.end()
    fxBatch.end()
    shadowBatch.end()
  })

  useSystem(ORDER.labels, (_dt, state) => overlay.flush(state.camera, performance.now()))

  return (
    <>
      <primitive object={spinnerBatch.group} />
      <primitive object={shadowBatch.mesh} />
      <primitive object={fxBatch.mesh} />
    </>
  )
}

export default Effects
