import {
  AURAS,
  CRYSTAL_OFFER,
  DAILY_REWARDS,
  GOLDEN,
  LIMITS,
  POTIONS,
  SHOP_ITEMS,
  SPINNERS,
  TRAILS,
  dayKey,
  formatNumber,
  giftById,
  potionActive,
  questProgress,
  rebirthLevelReq,
  resolveReward,
  slotsFor,
  spinnerPrice,
  spinnerScore,
} from '../../../shared/index.js'
import { addSpinner, equipBest, fixEquipped } from './profiles.js'

/**
 * Every purchase and inventory action. Each takes the profile, mutates it if the
 * action is allowed, and returns `{ ok: true, ... }` or `{ ok: false, error }` with a
 * player-facing message. The room turns errors into toasts.
 *
 * Currency is only ever wins or rebirth requirements - never Bux.
 */

const fail = (error) => ({ ok: false, error })

/**
 * Puts a new spinner on the team: into a free slot, or in place of the weakest equipped
 * one when it is stronger. Returns whether it was equipped, so the reveal can say
 * "Joined your team!" instead of leaving players wondering where it went.
 */
function joinTeam(p, item) {
  if (p.equipped.length < slotsFor(p.level, p.rebirths)) {
    p.equipped.push(item.uid)
    return true
  }
  let weakest = -1
  let weakestScore = spinnerScore(item.id, item.golden)
  p.equipped.forEach((uid, i) => {
    const own = p.inventory.find((s) => s.uid === uid)
    const score = own ? spinnerScore(own.id, own.golden) : -1
    if (score < weakestScore) {
      weakest = i
      weakestScore = score
    }
  })
  if (weakest < 0) return false
  p.equipped[weakest] = item.uid
  return true
}

/* ---------------------------------------------------------------------------
 * Capsules
 * ------------------------------------------------------------------------- */

/**
 * Buys one spinner from the Spinners Shop, at its price (25% off with a Lucky potion).
 * It joins the team when there's room or it beats the weakest member.
 */
export function buySpinner(p, id, now = Date.now()) {
  const item = SHOP_ITEMS[id]
  if (!item) return fail('That spinner is not for sale')
  if (p.rebirths < item.rebirths) return fail(`Requires Rebirth ${item.rebirths}!`)
  const price = spinnerPrice(id, potionActive(p, 'lucky', now))
  if (p.wins < price) return fail(`Not enough wins! (${formatNumber(price)})`)
  if (p.inventory.length >= LIMITS.inventory) return fail('Inventory full! Delete or craft spinners.')
  p.wins -= price
  const added = addSpinner(p, id)
  // (The stat keeps its old name: quests count spinners bought with it.)
  p.stats.capsules += 1
  return { ok: true, results: [{ uid: added.item.uid, id, isNew: added.isNew, equipped: joinTeam(p, added.item) }] }
}

export function buyCrystal(p) {
  if (p.rebirths < CRYSTAL_OFFER.rebirths) return fail(`Requires Rebirth ${CRYSTAL_OFFER.rebirths}!`)
  if (p.wins < CRYSTAL_OFFER.cost) return fail(`Not enough wins! (${formatNumber(CRYSTAL_OFFER.cost)})`)
  if (p.inventory.length >= LIMITS.inventory) return fail('Inventory full!')
  p.wins -= CRYSTAL_OFFER.cost
  const added = addSpinner(p, CRYSTAL_OFFER.spinner)
  p.stats.crystal += 1
  const equipped = joinTeam(p, added.item)
  return { ok: true, results: [{ uid: added.item.uid, id: CRYSTAL_OFFER.spinner, isNew: added.isNew, equipped }] }
}

/* ---------------------------------------------------------------------------
 * Inventory
 * ------------------------------------------------------------------------- */

const findItem = (p, uid) => p.inventory.find((s) => s.uid === uid)

export function equip(p, uid) {
  if (!findItem(p, uid)) return fail('Spinner not found')
  if (p.equipped.includes(uid)) return { ok: true }
  if (p.equipped.length >= slotsFor(p.level, p.rebirths)) {
    return fail('All slots full! Level up for more slots.')
  }
  p.equipped.push(uid)
  return { ok: true }
}

/**
 * Puts a spinner in a given team slot (0-based). Into a filled slot it replaces that
 * spinner, which moves to the chosen one's old slot if it had one; into an open slot
 * past the team it just joins.
 */
export function equipSlot(p, slot, uid) {
  if (!findItem(p, uid)) return fail('Spinner not found')
  const slots = slotsFor(p.level, p.rebirths)
  if (!Number.isInteger(slot) || slot < 0) return fail('No such slot')
  if (slot >= slots) return fail('That slot is locked! Level up to unlock it.')
  const from = p.equipped.indexOf(uid)
  if (slot >= p.equipped.length) {
    if (from >= 0) p.equipped.splice(from, 1)
    p.equipped.push(uid)
    return { ok: true }
  }
  const other = p.equipped[slot]
  if (from >= 0) p.equipped[from] = other
  p.equipped[slot] = uid
  return { ok: true }
}

export function unequip(p, uid) {
  p.equipped = p.equipped.filter((u) => u !== uid)
  return { ok: true }
}

export function doEquipBest(p) {
  equipBest(p)
  return { ok: true }
}

export function unequipAll(p) {
  p.equipped = []
  return { ok: true }
}

export function deleteSpinners(p, uids) {
  const kill = new Set((Array.isArray(uids) ? uids : []).slice(0, LIMITS.inventory))
  const before = p.inventory.length
  p.inventory = p.inventory.filter((s) => !(kill.has(s.uid) && !s.locked))
  const removed = before - p.inventory.length
  if (!removed) return fail('Nothing deleted (locked spinners are protected)')
  // Never leave a player with nothing to fight with.
  if (p.inventory.length === 0) addSpinner(p, 'basic')
  fixEquipped(p)
  return { ok: true, removed }
}

export function lockSpinner(p, uid) {
  const item = findItem(p, uid)
  if (!item) return fail('Spinner not found')
  item.locked = !item.locked
  return { ok: true }
}

/** Five non-golden copies of `id` become one golden copy. Equipped copies count. */
export function craftGolden(p, id) {
  if (!SPINNERS[id]) return fail('Unknown spinner')
  const copies = p.inventory.filter((s) => s.id === id && !s.golden)
  if (copies.length < GOLDEN.craftCount) return fail(`Need ${GOLDEN.craftCount} of the same spinner!`)
  // Use unlocked, unequipped copies first.
  copies.sort((a, b) => Number(a.locked) - Number(b.locked) || Number(p.equipped.includes(a.uid)) - Number(p.equipped.includes(b.uid)))
  const used = new Set(copies.slice(0, GOLDEN.craftCount).map((s) => s.uid))
  p.inventory = p.inventory.filter((s) => !used.has(s.uid))
  const added = addSpinner(p, id, true)
  fixEquipped(p)
  const equipped = joinTeam(p, added.item)
  p.stats.golden += 1
  return { ok: true, results: [{ uid: added.item.uid, id, golden: true, isNew: false, equipped }] }
}

/* ---------------------------------------------------------------------------
 * Trails and auras
 * ------------------------------------------------------------------------- */

export function buyTrail(p, id) {
  const trail = TRAILS[id]
  if (!trail) return fail('Unknown trail')
  if (p.trails.includes(id)) return equipTrail(p, id)
  if (p.rebirths < trail.rebirths) return fail(`Requires Rebirth ${trail.rebirths}!`)
  if (p.wins < trail.cost) return fail(`Not enough wins! (${formatNumber(trail.cost)})`)
  p.wins -= trail.cost
  p.trails.push(id)
  p.trail = id
  return { ok: true }
}

export function equipTrail(p, id) {
  if (id && !p.trails.includes(id)) return fail("You don't own that trail")
  p.trail = id || ''
  return { ok: true }
}

export function buyAura(p, id) {
  const aura = AURAS[id]
  if (!aura) return fail('Unknown aura')
  if (p.auras.includes(id)) return equipAura(p, id)
  if (p.rebirths < aura.rebirths) return fail(`Requires Rebirth ${aura.rebirths}!`)
  if (p.wins < aura.cost) return fail(`Not enough wins! (${formatNumber(aura.cost)})`)
  p.wins -= aura.cost
  p.auras.push(id)
  p.aura = id
  return { ok: true }
}

export function equipAura(p, id) {
  if (id && !p.auras.includes(id)) return fail("You don't own that aura")
  p.aura = id || ''
  return { ok: true }
}

/* ---------------------------------------------------------------------------
 * Rebirth
 * ------------------------------------------------------------------------- */

export function rebirth(p) {
  const need = rebirthLevelReq(p.rebirths)
  if (p.level < need) return fail(`Reach Level ${need} to rebirth!`)
  // Rebirth trades your level for a permanent power boost. Wins are kept: they are
  // what capsules cost, and wiping them made saving for a big capsule pointless.
  p.rebirths += 1
  p.level = 1
  p.power = 0
  fixEquipped(p)
  return { ok: true, rebirths: p.rebirths }
}

/* ---------------------------------------------------------------------------
 * Potions, gifts, daily rewards
 * ------------------------------------------------------------------------- */

export function usePotion(p, id, now = Date.now()) {
  const potion = POTIONS[id]
  if (!potion) return fail('Unknown potion')
  if (!(p.potions[id] > 0)) return fail(`No ${potion.name} potions left`)
  p.potions[id] -= 1
  // Stacks: drinking another one extends the timer.
  const base = Math.max(now, p.activePotions[id] || 0)
  p.activePotions[id] = base + potion.minutes * 60 * 1000
  return { ok: true }
}

/** Adds a resolved reward (see formulas.resolveReward) to the profile. */
export function grantReward(p, reward) {
  if (reward.wins) {
    p.wins += reward.wins
    p.stats.totalWins += reward.wins
  }
  if (reward.potion) p.potions[reward.potion] = (p.potions[reward.potion] || 0) + 1
}

/** Resets the playtime-gift clock at the start of each UTC day. */
export function rollGiftDay(p, now = Date.now()) {
  const today = dayKey(now)
  if (p.gifts.day !== today) p.gifts = { day: today, seconds: 0, claimed: [] }
}

export function claimGift(p, id, now = Date.now()) {
  rollGiftDay(p, now)
  const gift = giftById(id)
  if (!gift) return fail('Unknown gift')
  if (p.gifts.claimed.includes(id)) return fail('Already claimed')
  if (p.gifts.seconds < gift.minutes * 60) return fail('Not ready yet!')
  const reward = resolveReward(gift.reward, p)
  grantReward(p, reward)
  p.gifts.claimed.push(id)
  return { ok: true, reward }
}

export function dailyStatus(p, now = Date.now()) {
  const today = dayKey(now)
  const yesterday = dayKey(now - 24 * 3600 * 1000)
  const canClaim = p.daily.day !== today
  const streak = p.daily.day === yesterday || p.daily.day === today ? p.daily.streak : 0
  const nextDay = canClaim ? (streak % DAILY_REWARDS.length) + 1 : null
  return { canClaim, streak, nextDay }
}

export function claimDaily(p, now = Date.now()) {
  const status = dailyStatus(p, now)
  if (!status.canClaim) return fail('Come back tomorrow!')
  const entry = DAILY_REWARDS[status.nextDay - 1]
  const reward = resolveReward(entry.reward, p)
  grantReward(p, reward)
  p.daily = { day: dayKey(now), streak: status.streak + 1 }
  return { ok: true, reward, day: status.nextDay }
}

/* ---------------------------------------------------------------------------
 * Quests
 * ------------------------------------------------------------------------- */

/**
 * Pays out the current quest if it is complete, then the next, and so on (one action
 * can finish several). Returns the list of completed quests with their rewards.
 */
export function checkQuests(p) {
  const done = []
  for (let guard = 0; guard < 10; guard += 1) {
    const q = questProgress(p)
    if (!q.done) break
    const spec = q.quest.reward
    const reward = resolveReward(spec, p)
    if (spec.winsFlat) reward.wins += spec.winsFlat
    grantReward(p, reward)
    p.quest += 1
    done.push({ text: q.quest.text, reward })
  }
  return done
}
