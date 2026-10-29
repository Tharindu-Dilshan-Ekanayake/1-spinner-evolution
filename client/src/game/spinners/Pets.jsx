import { LOBBY, RING_POSITIONS, SPINNERS, formatNumber } from '@shared'

import { sfx } from '../../audio/sfx'
import { live } from '../../store/live'
import { quality } from '../../store/qualityStore'
import { groundAt } from '../collision'
import { ORDER, useSystem } from '../loop'
import { overlay, popup } from '../overlay/worldOverlay'
import { SPRITE, fxBatch, shadowBatch } from '../render/fxBatch'
import { fx } from '../render/particles'
import { ringFx } from '../world/ringFx'
import { auraBody, auraLevel, pushAura } from './spinnerAura'
import { elementOf, pushElement } from './spinnerElement'
import { spinnerBatch, spinnerPalette } from './spinnerBatch'

/**
 * Every player's equipped spinners, following them like pets (the original's
 * "2 SPINNERS" trailing behind the avatar).
 *
 * At a training ring they orbit the target dummy and dash into it. For our own team
 * the dashes are driven by the server's hit events (so "+12" pops in sync with real
 * power gains); other players' pets just attack on a timer.
 */

const PET_SCALE = 0.72
const SPIN_SPEED = 17
/**
 * Where spinner `i` of `n` sits in a training ring's dish. Up to 8 share one orbit, with
 * room to spare; a bigger team (the most is 11) uses two, an inner one of 40% and an
 * outer one of 60%, each spinner a little smaller, so all 11 fit without touching.
 */
const ORBIT = { one: LOBBY.ringRadius * 0.6, inner: LOBBY.ringRadius * 0.43, outer: LOBBY.ringRadius * 0.75 }
const CROWDED = 9
const orbitOf = (i, n) => {
  if (n < CROWDED) return { r: ORBIT.one, k: i, of: n }
  const outer = Math.ceil(n * 0.6)
  // The inner ring is half a step round, so its spinners sit between the outer ones.
  return i < outer ? { r: ORBIT.outer, k: i, of: outer } : { r: ORBIT.inner, k: i - outer + 0.5, of: n - outer }
}
const DASH_SPEED = 3.2
/** Spinners stand on their tip just above the floor decals (paths, carpets). */
const GROUND_LIFT = 0.06

function ensurePets(owner, n) {
  if (!owner.pets) owner.pets = []
  while (owner.pets.length < n) {
    owner.pets.push({ x: owner.x, y: owner.y, z: owner.z, angle: Math.random() * 6, attack: 0, timer: Math.random(), wobble: Math.random() * 6 })
  }
  return owner.pets
}

/**
 * Moves and draws one owner's pets.
 * @param owner  live.player or a remote record (x, y, z, ry, pets)
 * @param team   [{ id, golden, hpText? }]
 * @param ring   training ring id or null
 * @param isLocal draw HP labels + react to server hit events
 */
function updateOwner(owner, team, ring, n, dt, now, camera, isLocal, q) {
  const pets = ensurePets(owner, n)
  const center = ring ? RING_POSITIONS[ring] : null
  const follow = 1 - Math.exp(-dt * (center ? 6 : 7))

  for (let i = 0; i < n; i += 1) {
    const pet = pets[i]
    const member = team[i]
    const def = SPINNERS[member.id]
    let tx
    let tz
    let ty
    if (center) {
      const o = orbitOf(i, n)
      // Both orbits turn the same way, the inner one a little faster.
      const a = (o.k / o.of) * Math.PI * 2 + now * (o.r === ORBIT.inner ? 0.0009 : 0.0006)
      tx = center.x + Math.cos(a) * o.r
      tz = center.z + Math.sin(a) * o.r
      // On the training ring's dish (its floor is 0.15 up).
      ty = 0.1
      if (!isLocal) {
        pet.timer -= dt
        if (pet.timer <= 0) {
          pet.timer = 0.7 + Math.random() * 0.4
          pet.attack = 1
          const rf = ringFx[ring]
          if (rf) rf.flash = 1
        }
      }
      if (pet.attack > 0) {
        // Dash in and bounce back out: sin() peaks halfway.
        const k = Math.sin((1 - pet.attack) * Math.PI) * 0.78
        tx += (center.x - tx) * k
        tz += (center.z - tz) * k
        pet.attack = Math.max(0, pet.attack - dt * DASH_SPEED)
      }
    } else {
      // Small teams walk beside the owner (like the original's pair); bigger teams
      // fan out in rows of three behind, so the camera still sees the avatar.
      let back
      let side
      if (n <= 2) {
        back = 0.6
        side = i === 0 ? -1.5 : 1.5
      } else {
        const row = Math.floor(i / 3)
        back = 1.6 + row * 1.5
        side = ((i % 3) - 1) * (1.7 + row * 0.25)
      }
      const s = Math.sin(owner.ry)
      const c = Math.cos(owner.ry)
      tx = owner.x - s * back + c * side
      tz = owner.z - c * back - s * side
      // Whatever floor is under the pet (a pad, a step), not the owner's height.
      const ground = groundAt(tx, tz, owner.y + 0.3)
      ty = ground > -1e6 ? ground : owner.y
    }

    const k = center && pet.attack > 0 ? 1 - Math.exp(-dt * 22) : follow
    pet.x += (tx - pet.x) * k
    pet.z += (tz - pet.z) * k
    pet.y += (ty - pet.y) * Math.min(1, dt * 10)
    pet.angle += SPIN_SPEED * dt
    pet.wobble += dt * 3

    const crowded = center && n >= CROWDED
    const scale = PET_SCALE * (def.scale || 1) * (crowded ? 0.85 : 1)
    const level = auraLevel(def, member.golden)
    const y = pet.y + GROUND_LIFT + Math.abs(Math.sin(pet.wobble * 1.7)) * 0.03
    spinnerBatch.push(def.family, pet.x, y, pet.z, pet.angle, 0.06, pet.wobble, scale, spinnerPalette(member.id), auraBody(level), pet.attack > 0.6 ? 0.4 : 0, member.golden)
    shadowBatch.push(pet.x, pet.y + 0.04, pet.z, 1.7 * scale, 0, 0, 0.05, 0.35, SPRITE.glow, true)
    // A faint spinning ring where the tip touches the floor.
    if (q.glow) fxBatch.push(pet.x, pet.y + 0.05, pet.z, 1.5 * scale, 1, 1, 1, 0.16, SPRITE.ring, true, pet.angle)
    // The aura: every spinner glows, the rarer the brighter (see spinnerAura.js).
    if (q.glow) pushAura(pet.x, y, pet.z, scale, spinnerPalette(member.id), level, member.golden, now * 0.001, i * 1.7)
    // Fire / lightning: steady while training at a ring, a flare on every dash (see spinnerElement.js).
    if (q.elements > 0) {
      const kind = elementOf(member.id)
      if (kind) pushElement(kind, pet.x, y, pet.z, 0.95 * scale, now * 0.001, i * 1.3, center ? 0.55 + 0.45 * pet.attack : pet.attack, q.elements)
    }
    if (member.golden && q.particles && Math.random() < dt * 2) fx.sparkle(pet.x, y + 0.6, pet.z)
    if (isLocal && !center && member.hpText) {
      // Just above its own spinner, small: higher up it sat over the player's arms.
      overlay.hp(camera, pet.x, y + 0.78, pet.z, 1, 1, 0, '', member.hpText, true)
    }
  }
}

/** Turns the server's training hits into dashes, dummy flashes and "+N" popups. */
function consumeGains(center, ring) {
  const g = live.gains
  if (!g.length) return
  const pets = live.player.pets
  for (let i = 0; i + 1 < g.length; i += 2) {
    const slot = g[i]
    const amount = g[i + 1]
    if (!center) continue
    if (slot >= 0 && pets && pets[slot]) {
      pets[slot].attack = 1
      // Fanned out by slot, so 11 spinners' numbers don't pile up on one spot.
      popup(center.x + ((slot % 3) - 1) * 1.1, 2.2 + (slot % 4) * 0.45, center.z, `+${formatNumber(amount)}`, 'power')
    } else {
      popup(center.x, 3, center.z, `+${formatNumber(amount)}`, 'crit')
    }
    const rf = ringFx[ring]
    if (rf) {
      rf.flash = 1
      rf.shake = 1
    }
    fx.hit(center.x, 0.9, center.z, slot < 0)
    sfx.hit(false)
  }
  g.length = 0
}

export function Pets() {
  useSystem(ORDER.pets, (dt, state) => {
    const q = quality()
    const now = performance.now()
    const camera = state.camera

    // Our own team (hidden while our spinners are in the arena).
    const ring = live.zone === 'lobby' ? live.ring : null
    const center = ring ? RING_POSITIONS[ring] : null
    if (!live.battle && live.team.length) {
      updateOwner(live.player, live.team, ring, live.team.length, dt, now, camera, true, q)
    }
    consumeGains(center, ring)

    // Everyone else in our zone.
    const maxD = q.viewDistance * 0.7
    const list = live.remoteList
    for (let i = 0; i < list.length; i += 1) {
      const r = list[i]
      if (r.zone !== live.zone || r.battling || !r.team.length) continue
      const dx = r.x - live.player.x
      const dz = r.z - live.player.z
      if (dx * dx + dz * dz > maxD * maxD) continue
      const n = Math.min(r.team.length, q.petsPerRemote)
      updateOwner(r, r.team, live.zone === 'lobby' && r.ring ? r.ring : null, n, dt, now, camera, false, q)
    }
  })
  return null
}

export default Pets
