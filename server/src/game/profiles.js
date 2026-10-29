import { AURAS, LIMITS, MAX_LEVEL, SPINNERS, levelNeed, slotsFor, spinnerScore } from '../../../shared/index.js'

/**
 * The persisted save of one player, and the few operations every other module needs
 * (granting power with level-ups, keeping the equipped team valid).
 */

export const PROFILE_VERSION = 1

export function createProfile(key, name) {
  const now = Date.now()
  return migrateProfile({
    version: PROFILE_VERSION,
    key,
    name,
    createdAt: now,
    lastSeen: now,
    level: 1,
    power: 0,
    wins: 0,
    rebirths: 0,
    nextUid: 2,
    // Everyone starts with one spinner, like the original; Level 2 brings the next.
    inventory: [{ uid: 1, id: 'rookie', golden: false, locked: true }],
    equipped: [1],
    index: { rookie: true },
    // First-time tutorial: train, beat Stage 1, bring the wins back on the Return pad.
    tutorialDone: false,
  })
}

/** Fills in anything an older save is missing, so loading never crashes on a field. */
export function migrateProfile(p) {
  p.version = PROFILE_VERSION
  p.level = Math.max(1, Math.min(MAX_LEVEL, p.level || 1))
  p.power = p.power || 0
  p.wins = p.wins || 0
  p.rebirths = p.rebirths || 0
  p.nextUid = p.nextUid || 1
  // Spinners no longer in the game (the Halloween ones) leave the save.
  const saved = Array.isArray(p.inventory) ? p.inventory : []
  p.inventory = saved.filter((s) => SPINNERS[s.id])
  const removed = saved.length - p.inventory.length
  p.equipped = Array.isArray(p.equipped) ? p.equipped : []
  p.trails = Array.isArray(p.trails) ? p.trails : []
  p.trail = p.trail || ''
  p.auras = (Array.isArray(p.auras) ? p.auras : []).filter((id) => AURAS[id])
  p.aura = p.auras.includes(p.aura) ? p.aura : ''
  p.potions = { power: 0, wins: 0, lucky: 0, ...(p.potions || {}) }
  p.activePotions = { power: 0, wins: 0, lucky: 0, ...(p.activePotions || {}) }
  p.best = { grassland: 0, lava: 0, galaxy: 0, ...(p.best || {}) }
  p.quest = p.quest || 0
  p.stats = {
    playtime: 0,
    totalWins: 0,
    totalPower: 0,
    capsules: 0,
    golden: 0,
    battlesWon: 0,
    battlesLost: 0,
    crystal: 0,
    ...(p.stats || {}),
  }
  p.index = p.index || {}
  p.daily = { day: '', streak: 0, ...(p.daily || {}) }
  p.gifts = { day: '', seconds: 0, claimed: [], ...(p.gifts || {}) }
  p.autoWin = Boolean(p.autoWin)
  // Saves from before the tutorial existed: only a player with no progress at all
  // still gets it; everyone else already knows the game.
  if (typeof p.tutorialDone !== 'boolean') {
    p.tutorialDone = p.level > 1 || p.rebirths > 0 || p.best.grassland > 0 || p.stats.capsules > 0
  }
  // What the Halloween event left behind.
  delete p.candy
  delete p.pumpkins
  delete p.best.halloween
  delete p.stats.candy
  // Never empty-handed (a save holding only removed spinners).
  if (!p.inventory.length) p.inventory.push({ uid: p.nextUid, id: 'rookie', golden: false, locked: true })
  for (const s of p.inventory) if (s.uid >= p.nextUid) p.nextUid = s.uid + 1
  fixEquipped(p)
  // Their slots don't stay empty: the best spinners left fill the team.
  if (removed > 0) equipBest(p)
  return p
}

/** Drops missing uids and trims the team to the current slot count. */
export function fixEquipped(p) {
  const owned = new Set(p.inventory.map((s) => s.uid))
  const seen = new Set()
  p.equipped = p.equipped.filter((uid) => owned.has(uid) && !seen.has(uid) && seen.add(uid))
  const slots = slotsFor(p.level, p.rebirths)
  if (p.equipped.length > slots) p.equipped.length = slots
}

/** Equips the strongest spinners into every free slot (and replaces weaker ones). */
export function equipBest(p) {
  const slots = slotsFor(p.level, p.rebirths)
  p.equipped = [...p.inventory]
    .sort((a, b) => spinnerScore(b.id, b.golden) - spinnerScore(a.id, a.golden))
    .slice(0, slots)
    .map((s) => s.uid)
}

/** The spinner a new slot comes with when there's no spare one to put in it. */
export const SLOT_GIFT = 'basic'

/**
 * Adds power and processes level-ups.
 * @returns {{ from: number, to: number, gifts: Array } | null} the level change, if any.
 *    lists free spinners handed out to fill newly opened slots.
 */
export function grantPower(p, amount) {
  if (!(amount > 0)) return null
  p.power += amount
  p.stats.totalPower += amount
  const from = p.level
  while (p.level < MAX_LEVEL && p.power >= levelNeed(p.level)) {
    p.power -= levelNeed(p.level)
    p.level += 1
  }
  if (p.level >= MAX_LEVEL) p.power = Math.min(p.power, levelNeed(p.level))
  if (p.level === from) return null

  // New slots are filled automatically, so leveling up visibly adds a spinner: the
  // best spare one, or a free Basic Spinner when there's none (the "+1 Spinner").
  const gifts = []
  const slotsBefore = slotsFor(from, p.rebirths)
  const slots = slotsFor(p.level, p.rebirths)
  if (p.equipped.length < slots) {
    const free = [...p.inventory]
      .filter((s) => !p.equipped.includes(s.uid))
      .sort((a, b) => spinnerScore(b.id, b.golden) - spinnerScore(a.id, a.golden))
    while (p.equipped.length < slots && free.length) p.equipped.push(free.shift().uid)
    // Only slots that just opened get a gift (not ones the player emptied).
    let opened = slots - slotsBefore
    while (p.equipped.length < slots && opened > 0) {
      const added = addSpinner(p, SLOT_GIFT)
      if (!added) break
      p.equipped.push(added.item.uid)
      gifts.push({ uid: added.item.uid, id: SLOT_GIFT, isNew: added.isNew, equipped: true })
      opened -= 1
    }
  }
  return { from, to: p.level, gifts }
}

export function addSpinner(p, id, golden = false) {
  if (p.inventory.length >= LIMITS.inventory) return null
  const item = { uid: p.nextUid++, id, golden, locked: false }
  p.inventory.push(item)
  const isNew = !p.index[id]
  p.index[id] = true
  return { item, isNew }
}

/** "id" / "id*" strings for the public schema. */
export function teamCodes(p) {
  const byUid = new Map(p.inventory.map((s) => [s.uid, s]))
  return p.equipped
    .map((uid) => byUid.get(uid))
    .filter(Boolean)
    .map((s) => (s.golden ? `${s.id}*` : s.id))
}
