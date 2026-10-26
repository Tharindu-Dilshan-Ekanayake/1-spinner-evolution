import { bestGlobalStage } from './formulas.js'

/**
 * The quest chain shown in the top bar ("Train on a Target to reach Level 5!").
 *
 * Quests are strictly sequential; the server checks the current one after every
 * relevant action and pays out automatically. Progress is derived from the profile,
 * so nothing extra has to be persisted besides the quest index.
 *
 * reward.wins is in "wins units" (scales with the player's best stage, see
 * formulas.winsUnit); reward.winsFlat is an exact amount for the tutorial quests.
 */

const Q = (text, type, target, reward, extra = {}) => ({ text, type, target, reward, ...extra })

export const QUESTS = [
  Q('Train on a Target to reach Level 2!', 'level', 2, { winsFlat: 3 }),
  Q('Walk through the BATTLE STAGES door and beat Stage 1!', 'stage', 1, { winsFlat: 3 }),
  Q('Open a Basic Capsule in the Wins Shop!', 'capsules', 1, { potion: 'power' }),
  Q('Reach Level 5 to equip a 3rd spinner!', 'level', 5, { winsFlat: 10 }),
  Q('Clear Stage 3!', 'stage', 3, { winsFlat: 15 }),
  Q('Buy the Orange Trail!', 'trails', 1, { candy: 10 }),
  Q('Rebirth for a power multiplier!', 'rebirths', 1, { potion: 'lucky' }),
  Q('Open 10 capsules!', 'capsules', 10, { wins: 1 }),
  Q('Clear Stage 5!', 'stage', 5, { wins: 1 }),
  Q('Collect 20 candy (pumpkins & Halloween)!', 'candy', 20, { potion: 'wins' }),
  Q('Clear Halloween Stage 2!', 'halloween', 2, { candy: 20 }),
  Q('Reach Rebirth 2!', 'rebirths', 2, { wins: 2 }),
  Q('Equip 4 spinners at once!', 'equipped', 4, { potion: 'power' }),
  Q('Clear Stage 8!', 'stage', 8, { wins: 2 }),
  Q('Craft a Golden spinner (5 of the same)!', 'golden', 1, { potion: 'lucky' }),
  Q('Clear Stage 10 to finish Grassland!', 'stage', 10, { wins: 3 }),
  Q('Buy an Aura!', 'auras', 1, { candy: 30 }),
  Q('Reach Rebirth 3 to unlock AUTO WIN!', 'rebirths', 3, { wins: 2 }),
  Q('Clear Stage 11 in Lava Land!', 'stage', 11, { wins: 3 }),
  Q('Open 100 capsules!', 'capsules', 100, { potion: 'lucky' }),
  Q('Clear Halloween Stage 8!', 'halloween', 8, { candy: 100 }),
  Q('Reach Rebirth 5 for 2X POWER!', 'rebirths', 5, { wins: 3 }),
  Q('Clear Stage 15!', 'stage', 15, { wins: 3 }),
  Q('Buy the Crystal Spinner!', 'crystal', 1, { potion: 'wins' }),
  Q('Clear Stage 20 to finish Lava Land!', 'stage', 20, { wins: 4 }),
  Q('Reach Rebirth 7 to unlock the Galaxy!', 'rebirths', 7, { wins: 4 }),
  Q('Clear Stage 25!', 'stage', 25, { wins: 4 }),
  Q('Reach Rebirth 10 for 2X WINS!', 'rebirths', 10, { wins: 5 }),
  Q('Clear Stage 30 - beat the Galaxy!', 'stage', 30, { wins: 6 }),
  Q('Reach Rebirth 15!', 'rebirths', 15, { wins: 8 }),
]

/** Value of the stat a quest type tracks. */
function measure(type, profile) {
  const st = profile.stats || {}
  switch (type) {
    case 'level':
      return profile.level
    case 'stage':
      return bestGlobalStage(profile)
    case 'halloween':
      return profile.best?.halloween || 0
    case 'capsules':
      return st.capsules || 0
    case 'trails':
      return profile.trails.length
    case 'auras':
      return profile.auras.length
    case 'rebirths':
      return profile.rebirths
    case 'candy':
      return st.candy || 0
    case 'equipped':
      return profile.equipped.length
    case 'golden':
      return st.golden || 0
    case 'crystal':
      return profile.inventory.some((s) => s.id === 'crystal') || st.crystal ? 1 : 0
    default:
      return 0
  }
}

/**
 * The quest at `index`. Past the end of the chain, quests repeat forever: alternately
 * "reach the next rebirth" and "open 250 more capsules".
 */
export function questAt(index, profile) {
  if (index < QUESTS.length) return QUESTS[index]
  const n = index - QUESTS.length
  if (n % 2 === 0) {
    const target = Math.max(profile.rebirths + 1, 16 + Math.floor(n / 2))
    return Q(`Reach Rebirth ${target}!`, 'rebirths', target, { wins: 6, potion: 'lucky' })
  }
  const target = (Math.floor((profile.stats?.capsules || 0) / 250) + 1) * 250
  return Q(`Open ${target} capsules!`, 'capsules', target, { wins: 4, potion: 'power' })
}

/** { quest, progress, target, done } for the player's current quest. */
export function questProgress(profile) {
  const index = profile.quest || 0
  const quest = questAt(index, profile)
  const value = measure(quest.type, profile)
  return {
    index,
    quest,
    progress: Math.min(value, quest.target),
    target: quest.target,
    done: value >= quest.target,
  }
}
