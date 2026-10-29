import {
  AURAS,
  SHOP_ITEMS,
  GIFTS,
  GOLDEN,
  LIMITS,
  POTIONS,
  RARITIES,
  REBIRTH_PERKS,
  RINGS,
  SPINNERS,
  TRAILS,
  WORLDS,
} from './content.js'

/**
 * The game's math. Pure functions only - the server runs them authoritatively and the
 * client runs the same code to preview numbers in the UI.
 *
 * TUNING holds every constant the balance simulator sweeps, so balancing never means
 * hunting through formulas.
 */
export const TUNING = {
  /** Power needed for level L -> L+1: base * growth^(L-1) * (1 + linear * (L-1)). */
  levelBase: 60,
  // 1.23, not 1.25: each rebirth asks 5 more levels, and at 1.25 late rebirth cycles
  // ballooned to 8+ hours (run scripts/simulate-balance.mjs after changing these).
  levelGrowth: 1.23,
  levelLinear: 0.5,
  /** Battle HP / damage gained per level above 1. */
  levelStat: 0.08,
  /** Rebirth power multiplier step: x(1 + step * rebirths). */
  rebirthStep: 0.5,
  /** Level required for the next rebirth: base + step * rebirths. */
  // First rebirth at Level 8 (~6 min of play): at 5 it came before players knew the game.
  rebirthLevelBase: 8,
  rebirthLevelStep: 5,
  /** Seconds between automatic training hits, per spinner. */
  trainInterval: 0.8,
  /** A click while training adds this fraction of one full volley. */
  trainClickShare: 0.3,
  /** A click in battle grants this fraction of one volley as power. */
  battleClickShare: 0.12,
  /** Enemy army at stage 1 (total HP, total damage per hit). */
  stageHp: 10,
  stageDmg: 1,
  /** Per-stage strength growth: steep early, settling at `stageGrowth`. */
  stageGrowth: 1.8,
  stageGrowthEarly: 1.0,
  stageGrowthDecay: 0.62,
  /** Wins for clearing stage s: winsBase^(s-1). */
  winsBase: 1.72,
}

/* ---------------------------------------------------------------------------
 * Levels and rebirths
 * ------------------------------------------------------------------------- */

/** Power needed to go from `level` to `level + 1`. */
export function levelNeed(level) {
  const l = Math.max(1, level) - 1
  return Math.round(
    TUNING.levelBase * Math.pow(TUNING.levelGrowth, l) * (1 + TUNING.levelLinear * l),
  )
}

/** Battle HP/damage multiplier from level. */
export function levelMult(level) {
  return 1 + TUNING.levelStat * (Math.max(1, level) - 1)
}

export function rebirthMult(rebirths) {
  return 1 + TUNING.rebirthStep * rebirths
}

export function rebirthLevelReq(rebirths) {
  return TUNING.rebirthLevelBase + TUNING.rebirthLevelStep * rebirths
}

export function hasPerk(rebirths, perkId) {
  const perk = REBIRTH_PERKS.find((p) => p.id === perkId)
  return Boolean(perk && rebirths >= perk.rebirths)
}

/** The next perk a rebirth would move towards, or null when all are owned. */
export function nextPerk(rebirths) {
  return REBIRTH_PERKS.find((p) => p.rebirths > rebirths) || null
}

/**
 * Level-based spinner slots, as in the original: 1 at the start, a 2nd at Level 2,
 * then +1 every 5 levels (5, 10, 15 ...) up to 8.
 */
function levelSlots(level) {
  const l = Math.max(1, level)
  return Math.min(8, 1 + (l >= 2 ? 1 : 0) + Math.floor(l / 5))
}

/** Spinners a player may equip: level slots plus rebirth bonus slots. */
export function slotsFor(level, rebirths) {
  const fromLevel = levelSlots(level)
  let bonus = 0
  if (hasPerk(rebirths, 'slot1')) bonus += 1
  if (hasPerk(rebirths, 'slot2')) bonus += 1
  if (hasPerk(rebirths, 'slot3')) bonus += 1
  return fromLevel + bonus
}

/**
 * What unlocks every team slot there is, in order: the level slots ({ level }), then
 * the rebirth perks' slots ({ rebirths }).
 */
export function slotUnlocks() {
  const out = []
  for (let level = 1; out.length < levelSlots(1000); level += 1) {
    while (out.length < levelSlots(level)) out.push({ level })
  }
  for (const perk of REBIRTH_PERKS) if (perk.id.startsWith('slot')) out.push({ rebirths: perk.rebirths })
  return out
}

/** Level at which the next level-based slot unlocks, or null when maxed. */
export function nextSlotLevel(level) {
  if (levelSlots(level) >= 8) return null
  if (level < 2) return 2
  return (Math.floor(level / 5) + 1) * 5
}

/* ---------------------------------------------------------------------------
 * Spinners
 * ------------------------------------------------------------------------- */

export function spinnerStats(id, golden = false) {
  const def = SPINNERS[id]
  if (!def) return { dmg: 0, hp: 0 }
  const m = golden ? GOLDEN.statMult : 1
  return { dmg: def.dmg * m, hp: def.hp * m }
}

/** Sort key used by "Equip Best": damage first (it drives both training and battle). */
export function spinnerScore(id, golden = false) {
  const { dmg, hp } = spinnerStats(id, golden)
  return dmg * 1000 + hp / 1000
}

export function rarityOf(id) {
  return RARITIES[SPINNERS[id]?.rarity] || RARITIES.common
}

/* ---------------------------------------------------------------------------
 * Derived player stats
 *
 * `profile` is the persisted save (see server/src/game/profiles.js). `now` is ms since
 * the epoch, used for potion timers.
 * ------------------------------------------------------------------------- */

export function potionActive(profile, potionId, now = Date.now()) {
  return (profile.activePotions?.[potionId] || 0) > now
}

export function equippedSpinners(profile) {
  const byUid = new Map(profile.inventory.map((s) => [s.uid, s]))
  return profile.equipped.map((uid) => byUid.get(uid)).filter(Boolean)
}

export function computeStats(profile, now = Date.now()) {
  const trail = TRAILS[profile.trail]
  const aura = AURAS[profile.aura]
  const lvlMult = levelMult(profile.level)

  const team = equippedSpinners(profile)
  let teamDmg = 0
  let teamHp = 0
  for (const s of team) {
    const st = spinnerStats(s.id, s.golden)
    teamDmg += st.dmg
    teamHp += st.hp
  }

  const powerMult =
    rebirthMult(profile.rebirths) *
    (trail ? trail.power : 1) *
    (hasPerk(profile.rebirths, 'power2x') ? 2 : 1) *
    (potionActive(profile, 'power', now) ? 2 : 1)

  const winsMult =
    (aura ? aura.wins : 1) *
    (hasPerk(profile.rebirths, 'wins2x') ? 2 : 1) *
    (potionActive(profile, 'wins', now) ? 2 : 1)

  return {
    slots: slotsFor(profile.level, profile.rebirths),
    levelMult: lvlMult,
    powerMult,
    winsMult,
    dmgMult: lvlMult * (aura ? aura.dmg : 1),
    hpMult: lvlMult * (aura ? aura.hp : 1),
    speedMult: 1 + (trail ? trail.speed : 0),
    lucky: potionActive(profile, 'lucky', now),
    teamDmg,
    teamHp,
  }
}

/** Power gained by one training hit of a spinner with `dmg`, in ring `ringId`. */
export function trainGain(dmg, ringId, stats) {
  const ring = RINGS[ringId]
  return dmg * (ring ? ring.mult : 1) * stats.powerMult
}

/* ---------------------------------------------------------------------------
 * Stages
 * ------------------------------------------------------------------------- */

const stageCache = [null]

/** Total enemy-army strength multiplier from stage 1 to stage `s` (global numbering). */
function stageScale(s) {
  while (stageCache.length <= s) {
    const i = stageCache.length
    if (i === 1) {
      stageCache.push(1)
    } else {
      const g =
        TUNING.stageGrowth + TUNING.stageGrowthEarly * Math.pow(TUNING.stageGrowthDecay, i - 2)
      stageCache.push(stageCache[i - 1] * g)
    }
  }
  return stageCache[s]
}

/** Call after changing TUNING (the balance simulator does). */
export function resetFormulaCaches() {
  stageCache.length = 1
}

/**
 * The enemy army for a stage: total HP, total damage per hit, and how it is split
 * into individual spinners. From stage 4 on there is a crowned boss holding half the
 * HP; the rest is split between minions.
 */
export function stageArmy(worldId, stage) {
  const s = stage
  const k = stageScale(s)
  const hp = Math.round(TUNING.stageHp * k)
  const dmg = TUNING.stageDmg * k
  // Army size follows the stage's place inside its world, so every world ramps up
  // from a lone spinner to a boss with a full escort.
  const local = stage - (WORLDS[worldId]?.firstStage || 1) + 1
  const count = Math.min(6, 1 + Math.floor((local - 1) / 2) + (s > 10 ? 1 : 0))
  const hasBoss = local >= 4 && count > 1

  const units = []
  if (hasBoss) {
    units.push({ boss: true, hp: Math.round(hp * 0.5), dmg: dmg * 0.4 })
    const minions = count - 1
    for (let i = 0; i < minions; i += 1) {
      units.push({ boss: false, hp: Math.round((hp * 0.5) / minions), dmg: (dmg * 0.6) / minions })
    }
  } else {
    for (let i = 0; i < count; i += 1) {
      units.push({ boss: false, hp: Math.round(hp / count), dmg: dmg / count })
    }
  }
  return { hp, dmg, units, global: s }
}

/** Wins for clearing a stage (before multipliers). */
export function stageWins(worldId, stage) {
  return Math.round(Math.pow(TUNING.winsBase, stage - 1))
}

/** World that contains global stage `s`. */
export function worldOfStage(s) {
  for (const w of Object.values(WORLDS)) {
    if (s >= w.firstStage && s < w.firstStage + w.stageCount) return w
  }
  return null
}

export function worldUnlocked(worldId, profile) {
  const w = WORLDS[worldId]
  if (!w) return false
  if (profile.rebirths < w.rebirths) return false
  return bestGlobalStage(profile) >= w.requiresStage
}

/** Highest global stage this player has ever cleared. */
export function bestGlobalStage(profile) {
  const b = profile.best || {}
  return Math.max(b.grassland || 0, b.lava || 0, b.galaxy || 0)
}

/** A reward unit for gifts and quests: what a run to the player's best stage pays. */
export function winsUnit(profile) {
  const best = Math.max(2, bestGlobalStage(profile))
  return Math.max(5, Math.round(Math.pow(TUNING.winsBase, best - 1)))
}

/* ---------------------------------------------------------------------------
 * The Spinners Shop
 * ------------------------------------------------------------------------- */

/** While a Lucky potion runs, spinners cost this much of their price. */
export const LUCKY_DISCOUNT = 0.75

/** What a spinner costs right now (the Lucky potion takes 25% off), or null if not sold. */
export function spinnerPrice(id, lucky = false) {
  const item = SHOP_ITEMS[id]
  if (!item) return null
  return lucky ? Math.max(1, Math.round(item.cost * LUCKY_DISCOUNT)) : item.cost
}

/* ---------------------------------------------------------------------------
 * Gifts and rewards
 * ------------------------------------------------------------------------- */

/** Turns a reward spec ({ wins: units, potion }) into concrete amounts. */
export function resolveReward(reward, profile) {
  return {
    wins: reward.wins ? Math.round(reward.wins * winsUnit(profile)) : 0,
    potion: reward.potion && POTIONS[reward.potion] ? reward.potion : null,
  }
}

export function giftById(id) {
  return GIFTS.find((g) => g.id === id) || null
}

/** UTC day key, used for daily rewards and the playtime-gift reset. */
export function dayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10)
}

export const MAX_LEVEL = LIMITS.maxLevel

/* ---------------------------------------------------------------------------
 * Number formatting (shared so server toasts and the HUD read the same)
 * ------------------------------------------------------------------------- */

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc']

export function formatNumber(value) {
  const n = Number(value) || 0
  if (Math.abs(n) < 1000) return String(Math.floor(n))
  const tier = Math.min(SUFFIXES.length - 1, Math.floor(Math.log10(Math.abs(n)) / 3))
  const scaled = n / Math.pow(1000, tier)
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2
  return `${scaled.toFixed(digits).replace(/\.0+$|(\.\d*[1-9])0+$/, '$1')}${SUFFIXES[tier]}`
}
