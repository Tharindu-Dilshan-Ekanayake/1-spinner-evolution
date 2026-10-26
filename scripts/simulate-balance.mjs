/**
 * Plays the whole progression with a reasonable bot and prints how long each
 * milestone takes. Run with `npm run simulate` from the repo root.
 *
 * The bot trains (clicking ~4 times a second), runs stages as deep as its army can
 * win, spends wins on the best capsule / trail / aura it can afford, crafts golden
 * spinners and rebirths as soon as it may. It ignores gifts, quests, potions and
 * Halloween, so real players progress somewhat faster than this.
 *
 * Battle outcome uses the same model the server's sim converges to: an army wins when
 * its (total HP x total damage) beats the enemy's by a margin.
 */
import {
  AURA_LIST,
  CAPSULE_LIST,
  CRYSTAL_OFFER,
  GOLDEN,
  RING_LIST,
  TRAIL_LIST,
  WORLD_LIST,
} from '../shared/content.js'
import {
  TUNING,
  computeStats,
  formatNumber,
  levelNeed,
  rebirthLevelReq,
  resetFormulaCaches,
  rollCapsule,
  spinnerScore,
  spinnerStats,
  stageArmy,
  stageWins,
} from '../shared/formulas.js'

const HOURS = Number(process.argv[2] || 30)
const TRAIN_CPS = 4
const BATTLE_CLICK_MULT = 1.5
const HIT_RATE = 1.0
const WIN_MARGIN = 1.6
const TRAIN_CHUNK = 90
const STAGE_OVERHEAD = 8
const RUN_OVERHEAD = 12
const OPEN_SECONDS = 1.2
const MAX_OPENS_PER_TRIP = 60

function mulberry32(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function run(overrides = {}, { quiet = false, seed = 1 } = {}) {
  Object.assign(TUNING, overrides)
  resetFormulaCaches()
  const rand = mulberry32(seed)

  let uid = 0
  const p = {
    level: 1,
    power: 0,
    wins: 0,
    candy: 0,
    rebirths: 0,
    inventory: [{ uid: ++uid, id: 'rookie', golden: false }],
    equipped: [],
    trails: [],
    trail: '',
    auras: [],
    aura: '',
    activePotions: {},
    best: { grassland: 0, lava: 0, galaxy: 0 },
  }
  let t = 0
  const log = []
  const seen = new Set()
  const mark = (key, text) => {
    if (seen.has(key)) return
    seen.add(key)
    log.push({ t, text })
  }

  const equipBest = () => {
    const slots = computeStats(p).slots
    p.equipped = [...p.inventory]
      .sort((a, b) => spinnerScore(b.id, b.golden) - spinnerScore(a.id, a.golden))
      .slice(0, slots)
      .map((s) => s.uid)
  }
  equipBest()

  const ring = () => [...RING_LIST].reverse().find((r) => p.rebirths >= r.rebirths)

  const levelUp = () => {
    while (p.power >= levelNeed(p.level) && p.level < 400) {
      const before = computeStats(p).slots
      p.power -= levelNeed(p.level)
      p.level += 1
      // A newly opened slot comes with a Basic Spinner when there's no spare one.
      const opened = computeStats(p).slots - before
      for (let k = 0; k < opened && p.inventory.length < computeStats(p).slots; k += 1) {
        p.inventory.push({ uid: ++uid, id: 'basic', golden: false })
      }
      equipBest()
    }
  }

  const train = (seconds) => {
    const st = computeStats(p)
    const perSec = st.teamDmg * ring().mult * st.powerMult * (1 / TUNING.trainInterval + TRAIN_CPS * TUNING.trainClickShare)
    // Step in small slices so slot unlocks mid-session count.
    let left = seconds
    while (left > 0) {
      const dt = Math.min(5, left)
      const s2 = computeStats(p)
      p.power += s2.teamDmg * ring().mult * s2.powerMult * (1 / TUNING.trainInterval + TRAIN_CPS * TUNING.trainClickShare) * dt
      levelUp()
      left -= dt
    }
    t += seconds
    return perSec
  }

  const canWin = (world, stage) => {
    const st = computeStats(p)
    const army = stageArmy(world, stage)
    const mine = st.teamHp * st.hpMult * st.teamDmg * st.dmgMult * BATTLE_CLICK_MULT
    return mine > army.hp * army.dmg * WIN_MARGIN
  }

  const battleTime = (world, stage) => {
    const st = computeStats(p)
    const army = stageArmy(world, stage)
    return Math.min(60, army.hp / (st.teamDmg * st.dmgMult * BATTLE_CLICK_MULT * HIT_RATE) + 3)
  }

  const unlocked = (w) =>
    p.rebirths >= w.rebirths &&
    Math.max(p.best.grassland, p.best.lava, p.best.galaxy) >= w.requiresStage

  const stageRun = () => {
    let bestRate = 0
    let plan = null
    for (const w of WORLD_LIST) {
      if (w.event || !unlocked(w)) continue
      let time = RUN_OVERHEAD
      let wins = 0
      let cleared = 0
      for (let s = w.firstStage; s < w.firstStage + w.stageCount; s += 1) {
        if (!canWin(w.id, s)) break
        time += battleTime(w.id, s) + STAGE_OVERHEAD
        wins += stageWins(w.id, s)
        cleared = s
      }
      if (cleared && wins / time > bestRate) {
        bestRate = wins / time
        plan = { w, time, wins, cleared }
      }
    }
    if (!plan) return false
    const st = computeStats(p)
    p.wins += Math.round(plan.wins * st.winsMult)
    t += plan.time
    // Power from clicking during battles.
    p.power += st.teamDmg * ring().mult * st.powerMult * TUNING.battleClickShare * TRAIN_CPS * (plan.time - RUN_OVERHEAD)
    levelUp()
    if (plan.cleared > (p.best[plan.w.id] || 0)) {
      p.best[plan.w.id] = plan.cleared
      mark(`stage${plan.cleared}`, `cleared stage ${plan.cleared} (${plan.w.name})`)
    }
    return true
  }

  const shop = () => {
    let opened = 0
    let bought = true
    while (bought) {
      bought = false
      const nextTrail = TRAIL_LIST.find((tr) => !p.trails.includes(tr.id))
      if (nextTrail && p.rebirths >= nextTrail.rebirths && p.wins >= nextTrail.cost) {
        p.wins -= nextTrail.cost
        p.trails.push(nextTrail.id)
        p.trail = nextTrail.id
        mark(`trail-${nextTrail.id}`, `bought ${nextTrail.name}`)
        bought = true
        continue
      }
      const nextAura = AURA_LIST.find((a) => a.currency === 'wins' && !p.auras.includes(a.id))
      if (nextAura && p.rebirths >= nextAura.rebirths && p.wins >= nextAura.cost) {
        p.wins -= nextAura.cost
        p.auras.push(nextAura.id)
        p.aura = nextAura.id
        mark(`aura-${nextAura.id}`, `bought ${nextAura.name}`)
        bought = true
        continue
      }
      if (!p.inventory.some((s) => s.id === 'crystal') && p.rebirths >= CRYSTAL_OFFER.rebirths && p.wins >= CRYSTAL_OFFER.cost) {
        p.wins -= CRYSTAL_OFFER.cost
        p.inventory.push({ uid: ++uid, id: 'crystal', golden: false })
        mark('crystal', 'bought Crystal Spinner')
        bought = true
        continue
      }
      const capsule = [...CAPSULE_LIST]
        .reverse()
        .find((c) => c.currency === 'wins' && c.id !== 'exclusive' && p.rebirths >= c.rebirths && p.wins >= c.cost)
      if (capsule && opened < MAX_OPENS_PER_TRIP) {
        p.wins -= capsule.cost
        const id = rollCapsule(capsule.id, false, rand)
        p.inventory.push({ uid: ++uid, id, golden: false })
        mark(`cap-${capsule.id}`, `first ${capsule.name}`)
        // Opening animation + auto-open delay.
        t += OPEN_SECONDS
        opened += 1
        bought = true
      }
    }
    // Craft golden copies, then keep the inventory lean.
    const counts = new Map()
    for (const s of p.inventory) if (!s.golden) counts.set(s.id, (counts.get(s.id) || 0) + 1)
    for (const [id, n] of counts) {
      for (let k = 0; k < Math.floor(n / GOLDEN.craftCount); k += 1) {
        let removed = 0
        p.inventory = p.inventory.filter((s) => {
          if (removed < GOLDEN.craftCount && s.id === id && !s.golden) {
            removed += 1
            return false
          }
          return true
        })
        p.inventory.push({ uid: ++uid, id, golden: true })
      }
    }
    p.inventory.sort((a, b) => spinnerScore(b.id, b.golden) - spinnerScore(a.id, a.golden))
    p.inventory = p.inventory.slice(0, 60)
    equipBest()
  }

  const end = HOURS * 3600
  let cycleStart = 0
  const cycles = []
  while (t < end) {
    train(TRAIN_CHUNK)
    stageRun()
    shop()
    if (p.level >= rebirthLevelReq(p.rebirths)) {
      // Final push of the cycle, spend everything, then rebirth.
      stageRun()
      shop()
      p.rebirths += 1
      p.level = 1
      p.power = 0
      p.wins = 0
      equipBest()
      cycles.push(t - cycleStart)
      cycleStart = t
      mark(`R${p.rebirths}`, `REBIRTH ${p.rebirths}`)
    }
  }

  if (!quiet) {
    const fmt = (s) => {
      const h = Math.floor(s / 3600)
      const m = Math.floor((s % 3600) / 60)
      return h ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m${String(Math.floor(s % 60)).padStart(2, '0')}s`
    }
    for (const e of log) console.log(fmt(e.t).padStart(8), ' ', e.text)
    console.log('\nRebirth cycle lengths:', cycles.map((c) => fmt(c)).join(', '))
    const st = computeStats(p)
    console.log(
      `\nAfter ${HOURS}h: rebirths ${p.rebirths}, level ${p.level}, best ${JSON.stringify(p.best)}, ` +
        `team dmg ${formatNumber(st.teamDmg)}, spinners: ${p.equipped
          .map((u) => p.inventory.find((s) => s.uid === u))
          .map((s) => s.id + (s.golden ? '*' : ''))
          .join(', ')}`,
    )
    console.log('\nLevel needs:', [5, 10, 20, 30, 50, 75, 100].map((l) => `L${l}=${formatNumber(levelNeed(l))}`).join('  '))
    console.log(
      'Stage armies:',
      [1, 2, 3, 4, 5, 10, 15, 20, 25, 30]
        .map((s) => {
          const w = s <= 10 ? 'grassland' : s <= 20 ? 'lava' : 'galaxy'
          const a = stageArmy(w, s)
          return `S${s}=${formatNumber(a.hp)}hp/${formatNumber(a.dmg)}dmg`
        })
        .join('  '),
    )
    console.log('Spinner check:', spinnerStats('basic').dmg)
  }
  return { log, cycles, p }
}

run(process.argv[3] ? JSON.parse(process.argv[3]) : {})
