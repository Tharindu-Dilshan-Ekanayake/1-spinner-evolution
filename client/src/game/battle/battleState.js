import { BATTLE, arenaZ, decodeFrame, formatNumber } from '@shared'

/**
 * Client-side mirror of a server battle. The server sends ~20 frames a second; the
 * battle system (BattleView.jsx) interpolates between the last two so spinners move
 * smoothly at any frame rate.
 *
 * Written by network handlers, read by the frame loop.
 */

export function createBattle(msg) {
  const units = msg.units.map((u) => ({
    side: u.side,
    id: u.id,
    golden: u.golden,
    boss: u.boss,
    r: u.r,
    maxHp: u.maxHp,
    hp: u.maxHp,
    hpText: formatNumber(u.maxHp),
    // previous / target positions (arena-local), and the time the target arrived
    px: u.x,
    pz: u.z,
    tx: u.x,
    tz: u.z,
    spin: 10,
    angle: Math.random() * Math.PI * 2,
    flash: 0,
    alive: true,
    diedAt: 0,
  }))
  return {
    world: msg.world,
    stage: msg.stage,
    cx: 0,
    cz: arenaZ(msg.stage),
    units,
    frame: {
      time: 0,
      boost: 0,
      units: units.map(() => ({ x: 0, z: 0, hp: 0, spin: 0 })),
      hits: [],
      hitCount: 0,
    },
    lastAt: performance.now(),
    startAt: performance.now(),
    countdown: msg.countdown,
    time: 0,
    boost: 0,
    mine: 0,
    theirs: 0,
    maxMine: units.filter((u) => u.side === 0).reduce((s, u) => s + u.maxHp, 0),
    maxTheirs: units.filter((u) => u.side === 1).reduce((s, u) => s + u.maxHp, 0),
    /** Hits waiting for the frame loop to spawn sparks/popups: flat [x, z, dmg, side, ...] */
    hitQueue: [],
    /** Units that died since the frame loop last looked. */
    deaths: [],
    ended: false,
    result: null,
    line: msg.line,
  }
}

export function feedFrame(b, raw) {
  if (!b || b.ended) return
  const f = decodeFrame(raw, b.units.length, b.frame)
  b.time = f.time
  b.boost = f.boost
  let mine = 0
  let theirs = 0
  for (let i = 0; i < b.units.length; i += 1) {
    const u = b.units[i]
    const n = f.units[i]
    // Start the new segment from where the old one was heading.
    u.px = u.tx
    u.pz = u.tz
    u.tx = n.x
    u.tz = n.z
    u.spin = n.spin
    if (n.hp < u.hp) u.flash = 1
    if (n.hp !== u.hp) {
      u.hp = n.hp
      u.hpText = formatNumber(n.hp)
    }
    if (u.alive && n.hp <= 0) {
      u.alive = false
      u.diedAt = performance.now()
      b.deaths.push(i)
    }
    if (u.side === 0) mine += u.hp
    else theirs += u.hp
  }
  b.mine = mine
  b.theirs = theirs
  for (let h = 0; h < f.hitCount; h += 1) {
    const hit = f.hits[h]
    b.hitQueue.push(hit.x, hit.z, hit.dmg, hit.side)
  }
  b.lastAt = performance.now()
}

export function endBattle(b, msg) {
  if (!b) return
  b.ended = true
  b.result = msg.result
  b.endLine = msg.line
  b.endAt = performance.now()
}

/** 0..1 progress between the previous and the latest frame. */
export function frameAlpha(b, now) {
  return Math.min(1, (now - b.lastAt) / BATTLE.tickMs)
}
