import { SPINNERS, enemyPad, formatNumber, zoneOfWorld } from '@shared'

import { sfx } from '../../audio/sfx'
import { live } from '../../store/live'
import { quality } from '../../store/qualityStore'
import { ORDER, useSystem } from '../loop'
import { overlay, popup } from '../overlay/worldOverlay'
import { SPRITE, fxBatch, shadowBatch } from '../render/fxBatch'
import { fx } from '../render/particles'
import { enemyPalette, spinnerBatch, spinnerPalette } from '../spinners/spinnerBatch'
import { frameAlpha } from './battleState'

/** Enemy spinner silhouette per world (bosses always get the big saw). */
const ENEMY_FAMILY = { grassland: 'saw', lava: 'star', galaxy: 'blade', halloween: 'dome' }

/**
 * Draws the active battle: interpolated spinners, HP labels with skulls/crowns,
 * sparks and damage numbers for every hit, poofs for every knock-out, and the enemy
 * trainer's taunt above the red pad.
 */
export function BattleView() {
  useSystem(ORDER.battle, (dt, state) => {
    const b = live.battle
    // Grassland's arenas are in the lobby zone; every other world's are in its own.
    if (!b || live.zone !== zoneOfWorld(b.world)) return
    const now = performance.now()
    const a = frameAlpha(b, now)
    const camera = state.camera
    const q = quality()
    const fresh = now - b.startAt < 4000

    for (let i = 0; i < b.units.length; i += 1) {
      const u = b.units[i]
      const lx = u.px + (u.tx - u.px) * a
      const lz = u.pz + (u.tz - u.pz) * a
      // The sim fights along its x axis; the arena runs along the stage line (z).
      const x = b.cx - lz
      const z = b.cz + lx
      u.angle += u.spin * dt
      u.flash = Math.max(0, u.flash - dt * 6)

      if (!u.alive) {
        // Linger a moment after the knock-out, then vanish in the poof.
        if (now - u.diedAt > 120) continue
      }

      const enemy = u.side === 1
      const family = enemy ? (u.boss ? 'saw' : ENEMY_FAMILY[b.world] || 'saw') : SPINNERS[u.id]?.family || 'disc'
      const pal = enemy ? enemyPalette(b.world, u.boss) : spinnerPalette(u.id)
      const def = enemy ? null : SPINNERS[u.id]
      const tilt = 0.1 + Math.min(0.25, Math.hypot(u.tx - u.px, u.tz - u.pz) * 0.6)
      spinnerBatch.push(family, x, 0.17, z, u.angle, tilt, u.angle * 0.13, u.r, pal, def?.glow ? 0.6 : u.boss ? 0.25 : 0, u.flash * 0.8, u.golden)
      shadowBatch.push(x, 0.17, z, u.r * 2.2, 0, 0, 0.05, 0.4, SPRITE.glow, true)
      if (q.glow && (def?.glow || u.boss)) {
        fxBatch.push(x, 0.6, z, u.r * 3, pal.a.r, pal.a.g, pal.a.b, 0.45, SPRITE.glow)
      }
      // Speed ring while our team is boosted.
      if (!enemy && b.boost > 0.15) {
        fxBatch.push(x, 0.22, z, u.r * 3.2, 1, 0.75, 0.2, b.boost * 0.6, SPRITE.ring, true, u.angle)
      }
      if (u.alive) {
        overlay.hp(camera, x, 0.4 + u.r * 1.25, z, u.hp, u.maxHp, u.side, enemy ? (u.boss ? 'crown' : 'skull') : '', u.hpText)
      }
    }

    // Hits -> sparks, damage numbers, clash sounds.
    const hq = b.hitQueue
    for (let h = 0; h + 3 < hq.length; h += 4) {
      const x = b.cx - hq[h + 1]
      const z = b.cz + hq[h]
      const dmg = hq[h + 2]
      const side = hq[h + 3]
      fx.hit(x, 0.6, z, dmg > b.maxTheirs * 0.15)
      popup(x, 1.4, z, formatNumber(dmg), side === 0 ? 'dmg' : 'hurt')
      sfx.hit(side === 0 && b.boost > 0.5)
    }
    hq.length = 0

    for (let d = 0; d < b.deaths.length; d += 1) {
      const u = b.units[b.deaths[d]]
      const x = b.cx - u.tz
      const z = b.cz + u.tx
      fx.poof(x, 0.3, z)
      sfx.death()
    }
    b.deaths.length = 0

    // The enemy trainer's taunt, then their reaction.
    const pad = enemyPad(b.stage)
    const line = b.ended ? b.endLine : fresh ? b.line : null
    if (line) overlay.bubble(camera, pad.x, 4.1, pad.z, line)
  })
  return null
}

export default BattleView
