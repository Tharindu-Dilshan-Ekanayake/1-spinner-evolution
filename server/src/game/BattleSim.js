import { BATTLE, STAGE } from '../../../shared/index.js'

/**
 * Server-authoritative spinner battle in a circular arena.
 *
 * Spinners are circles on a plane. Each seeks the nearest enemy with a sideways swirl
 * (so they circle and clash rather than glue together), bounces off the arena wall
 * and off each other, and deals its damage to an enemy it touches at most once per
 * `BATTLE.hitCooldown`. Clicking adds "boost": more damage and speed for the player's
 * team, decaying over time.
 *
 * The client never simulates; it interpolates the frames this produces.
 */

const ARENA_R = STAGE.arenaRadius
const PLAYER_SPEED = 7.5
const ENEMY_SPEED = 6.6
const BOSS_SPEED = 5.2
const STEER = 16
const SWIRL = 0.65
const DRAG = 0.9
const RESTITUTION = 1.05
const CLASH_KNOCKBACK = 3.8
const RETARGET_S = 0.4

export class BattleSim {
  /**
   * @param {{ team: Array<{ id: string, golden: boolean, hp: number, dmg: number }>,
   *           army: { units: Array<{ boss: boolean, hp: number, dmg: number }> } }} setup
   */
  constructor({ team, army }) {
    this.time = 0
    this.boost = 0
    this.result = null
    this.units = []
    this.hits = []

    const nPlayer = team.length
    team.forEach((s, i) => {
      this.units.push(
        makeUnit({
          side: 0,
          x: 6.5 + (i % 2) * 1.6,
          z: spread(i, nPlayer, 2.2),
          hp: s.hp,
          dmg: s.dmg,
          r: BATTLE.playerRadius,
          speed: PLAYER_SPEED,
          boss: false,
        }),
      )
    })

    const nEnemy = army.units.length
    army.units.forEach((u, i) => {
      this.units.push(
        makeUnit({
          side: 1,
          x: u.boss ? -7.5 : -6 - (i % 2) * 1.6,
          z: u.boss ? 0 : spread(i, nEnemy, 2.4),
          hp: u.hp,
          dmg: u.dmg,
          r: u.boss ? BATTLE.bossRadius : BATTLE.minionRadius,
          speed: u.boss ? BOSS_SPEED : ENEMY_SPEED,
          boss: u.boss,
        }),
      )
    })
  }

  click() {
    if (this.result) return
    this.boost = Math.min(1, this.boost + BATTLE.clickBoost)
  }

  get started() {
    return this.time >= BATTLE.countdown
  }

  /** Total remaining HP per side, for the HUD's tug-of-war bar. */
  totals() {
    let mine = 0
    let theirs = 0
    for (const u of this.units) {
      if (u.side === 0) mine += Math.max(0, u.hp)
      else theirs += Math.max(0, u.hp)
    }
    return { mine, theirs }
  }

  step(dt) {
    this.hits.length = 0
    if (this.result) return
    this.time += dt
    if (!this.started) {
      for (const u of this.units) u.spin = 10 + Math.min(1, this.time / BATTLE.countdown) * 8
      return
    }

    this.boost = Math.max(0, this.boost - BATTLE.boostDecay * dt)
    const boostMult = 1 + this.boost * (BATTLE.maxBoostMult - 1)

    const units = this.units
    for (const u of units) {
      if (!u.alive) continue
      u.cd -= dt
      u.retarget -= dt
      if (u.retarget <= 0 || !u.target?.alive) {
        u.target = nearestEnemy(u, units)
        u.retarget = RETARGET_S
        u.swirlDir = Math.random() < 0.5 ? -1 : 1
      }

      const speed = u.speed * (u.side === 0 ? 1 + this.boost * 0.35 : 1)
      if (u.target) {
        const dx = u.target.x - u.x
        const dz = u.target.z - u.z
        const d = Math.hypot(dx, dz) || 1
        const nx = dx / d
        const nz = dz / d
        // Steer towards the target with a perpendicular swirl.
        const ax = nx - nz * SWIRL * u.swirlDir
        const az = nz + nx * SWIRL * u.swirlDir
        u.vx += ax * STEER * dt
        u.vz += az * STEER * dt
      }

      // Cap speed, apply a little drag.
      const v = Math.hypot(u.vx, u.vz)
      if (v > speed) {
        u.vx *= speed / v
        u.vz *= speed / v
      }
      u.vx *= 1 - DRAG * dt * 0.25
      u.vz *= 1 - DRAG * dt * 0.25
      u.x += u.vx * dt
      u.z += u.vz * dt

      // Arena wall: reflect.
      const limit = ARENA_R - u.r
      const dist = Math.hypot(u.x, u.z)
      if (dist > limit) {
        const nx = u.x / dist
        const nz = u.z / dist
        u.x = nx * limit
        u.z = nz * limit
        const vn = u.vx * nx + u.vz * nz
        if (vn > 0) {
          u.vx -= 1.8 * vn * nx
          u.vz -= 1.8 * vn * nz
        }
      }

      u.spin = (u.side === 0 ? 16 + this.boost * 14 : 15) * (0.55 + 0.45 * (u.hp / u.maxHp))
    }

    // Pairwise collisions (armies are at most ~20 units, so O(n^2) is fine).
    for (let i = 0; i < units.length; i += 1) {
      const a = units[i]
      if (!a.alive) continue
      for (let j = i + 1; j < units.length; j += 1) {
        const b = units[j]
        if (!b.alive) continue
        const dx = b.x - a.x
        const dz = b.z - a.z
        const minD = a.r + b.r
        const d2 = dx * dx + dz * dz
        if (d2 >= minD * minD) continue

        const d = Math.sqrt(d2) || 0.001
        const nx = dx / d
        const nz = dz / d
        const overlap = minD - d
        const ma = a.r * a.r
        const mb = b.r * b.r
        const total = ma + mb
        a.x -= nx * overlap * (mb / total)
        a.z -= nz * overlap * (mb / total)
        b.x += nx * overlap * (ma / total)
        b.z += nz * overlap * (ma / total)

        const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz
        if (rel < 0) {
          const impulse = (-(1 + RESTITUTION) * rel) / (1 / ma + 1 / mb)
          a.vx -= (impulse / ma) * nx
          a.vz -= (impulse / ma) * nz
          b.vx += (impulse / mb) * nx
          b.vz += (impulse / mb) * nz
        }

        if (a.side === b.side) continue

        // A clash: knock both back and trade damage.
        const kbA = CLASH_KNOCKBACK * (mb / total) * 2
        const kbB = CLASH_KNOCKBACK * (ma / total) * 2
        a.vx -= nx * kbA
        a.vz -= nz * kbA
        b.vx += nx * kbB
        b.vz += nz * kbB

        const hx = a.x + nx * a.r
        const hz = a.z + nz * a.r
        if (a.cd <= 0) this.hit(a, b, hx, hz, boostMult)
        if (b.cd <= 0) this.hit(b, a, hx, hz, boostMult)
      }
    }

    let mineAlive = false
    let theirsAlive = false
    for (const u of units) {
      if (!u.alive) continue
      if (u.side === 0) mineAlive = true
      else theirsAlive = true
    }
    if (!theirsAlive) this.result = 'win'
    else if (!mineAlive) this.result = 'lose'
    else if (this.time > BATTLE.countdown + BATTLE.maxSeconds) this.result = 'timeout'
  }

  hit(attacker, target, x, z, boostMult) {
    const dmg = attacker.dmg * (attacker.side === 0 ? boostMult : 1)
    target.hp -= dmg
    attacker.cd = BATTLE.hitCooldown
    this.hits.push({ x, z, dmg, side: attacker.side })
    if (target.hp <= 0) {
      target.hp = 0
      target.alive = false
      target.vx = 0
      target.vz = 0
      target.spin = 0
    }
  }
}

function makeUnit({ side, x, z, hp, dmg, r, speed, boss }) {
  return {
    side,
    x,
    z,
    vx: 0,
    vz: 0,
    hp,
    maxHp: hp,
    dmg,
    r,
    speed,
    boss,
    alive: true,
    cd: Math.random() * 0.2,
    retarget: 0,
    target: null,
    swirlDir: 1,
    spin: 10,
  }
}

/** Evenly spaces `n` items around 0 with `gap` between them. */
function spread(i, n, gap) {
  return (i - (n - 1) / 2) * gap * (n > 5 ? 0.75 : 1)
}

function nearestEnemy(u, units) {
  let best = null
  let bestD = Infinity
  for (const o of units) {
    if (!o.alive || o.side === u.side) continue
    const d = (o.x - u.x) ** 2 + (o.z - u.z) ** 2
    if (d < bestD) {
      bestD = d
      best = o
    }
  }
  return best
}
