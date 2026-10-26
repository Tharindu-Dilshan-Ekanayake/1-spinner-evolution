/**
 * Message names and the battle frame format, shared by server and client.
 *
 * Fast, public data (positions, level, equipped spinners) is Colyseus schema state.
 * Private progression (wins, inventory, quests) and battle frames are sent as
 * messages to the one client they belong to.
 */

/** client -> server */
export const C2S = {
  move: 'move',
  click: 'click',
  train: 'train',
  fight: 'fight',
  giveUp: 'giveUp',
  collectRun: 'collectRun',
  teleport: 'teleport',
  openCapsule: 'openCapsule',
  buyCrystal: 'buyCrystal',
  equip: 'equip',
  unequip: 'unequip',
  equipBest: 'equipBest',
  unequipAll: 'unequipAll',
  deleteSpinners: 'deleteSpinners',
  lockSpinner: 'lockSpinner',
  craftGolden: 'craftGolden',
  buyTrail: 'buyTrail',
  equipTrail: 'equipTrail',
  buyAura: 'buyAura',
  equipAura: 'equipAura',
  rebirth: 'rebirth',
  usePotion: 'usePotion',
  claimGift: 'claimGift',
  claimDaily: 'claimDaily',
  pumpkin: 'pumpkin',
  autoWin: 'autoWin',
  ping: 'ping',
  /** Test-only: ignored unless the server runs with ALLOW_CHEATS=1. */
  debug: 'debug',
}

/** server -> client */
export const S2C = {
  profile: 'profile',
  stats: 'stats',
  gain: 'gain',
  levelUp: 'levelUp',
  capsule: 'capsule',
  battleStart: 'battleStart',
  battleFrame: 'bf',
  battleEnd: 'battleEnd',
  run: 'run',
  teleported: 'teleported',
  toast: 'toast',
  quest: 'quest',
  leaderboards: 'leaderboards',
  reward: 'reward',
  fx: 'fx',
  pong: 'pong',
}

/** Animation states packed into the schema's `anim` byte. */
export const ANIM = { idle: 0, run: 1, jump: 2, battle: 3 }

export const BATTLE = {
  tickMs: 50,
  /** Seconds before spinners are released (the "3, 2, 1" in the HUD). */
  countdown: 2.2,
  maxSeconds: 75,
  /** A spinner can deal damage at most this often. */
  hitCooldown: 0.45,
  playerRadius: 0.85,
  minionRadius: 0.8,
  bossRadius: 1.55,
  /** Each click adds this much boost (0..1); boost decays per second. */
  clickBoost: 0.14,
  boostDecay: 0.7,
  /** Damage multiplier at full boost. */
  maxBoostMult: 2,
}

/** Battle frames pack positions as centimetre integers. */
export const POS_SCALE = 100

/**
 * Frame layout: [time, boost*100, ...units, -1, ...hits]
 *   unit: x, z, hp, spin  (x/z in cm, hp rounded up, spin = angular speed * 10)
 *   hit:  x, z, damage, side (0 = player dealt it, 1 = enemy dealt it)
 */
export function encodeFrame(time, boost, units, hits) {
  const out = [Math.round(time * 100), Math.round(boost * 100)]
  for (const u of units) {
    out.push(
      Math.round(u.x * POS_SCALE),
      Math.round(u.z * POS_SCALE),
      u.hp > 0 ? Math.ceil(u.hp) : 0,
      Math.round(u.spin * 10),
    )
  }
  out.push(-1)
  for (const h of hits) {
    out.push(Math.round(h.x * POS_SCALE), Math.round(h.z * POS_SCALE), Math.round(h.dmg), h.side)
  }
  return out
}

/** Inverse of encodeFrame. `unitCount` comes from the battleStart message. */
export function decodeFrame(frame, unitCount, out) {
  out.time = frame[0] / 100
  out.boost = frame[1] / 100
  let i = 2
  for (let u = 0; u < unitCount; u += 1) {
    const unit = out.units[u]
    unit.x = frame[i] / POS_SCALE
    unit.z = frame[i + 1] / POS_SCALE
    unit.hp = frame[i + 2]
    unit.spin = frame[i + 3] / 10
    i += 4
  }
  i += 1 // the -1 separator
  out.hitCount = 0
  while (i + 3 < frame.length) {
    const h = out.hits[out.hitCount] || (out.hits[out.hitCount] = { x: 0, z: 0, dmg: 0, side: 0 })
    h.x = frame[i] / POS_SCALE
    h.z = frame[i + 1] / POS_SCALE
    h.dmg = frame[i + 2]
    h.side = frame[i + 3]
    out.hitCount += 1
    i += 4
  }
  return out
}
