/**
 * Every piece of game content in one place: spinners, capsules, worlds, trails, auras,
 * training rings, potions and rebirth perks.
 *
 * Both the Colyseus server (authoritative) and the client (display) import this file,
 * so a number changed here changes it everywhere. Nothing in the game is bought with
 * Bux: prices are in wins or gated by rebirths.
 *
 * Balance notes live next to the numbers; `scripts/simulate-balance.mjs` plays the
 * whole progression with a bot and prints how long each milestone takes.
 */

/* ---------------------------------------------------------------------------
 * Rarities
 * ------------------------------------------------------------------------- */

export const RARITIES = {
  common: { name: 'Common', color: '#c3cfdf', order: 0 },
  uncommon: { name: 'Uncommon', color: '#5ee05e', order: 1 },
  rare: { name: 'Rare', color: '#38a8ff', order: 2 },
  epic: { name: 'Epic', color: '#b45cff', order: 3 },
  legendary: { name: 'Legendary', color: '#ffb321', order: 4 },
  mythic: { name: 'Mythic', color: '#ff3d6e', order: 5 },
  secret: { name: 'Secret', color: '#ffffff', order: 6, rainbow: true },
}

/* ---------------------------------------------------------------------------
 * Spinners
 *
 * family: the 3D silhouette (see client spinnerGeometry.js)
 *   disc  - chunky toothed disc (the classic "Basic Spinner")
 *   saw   - thin, wide saw blade with sharp teeth
 *   blade - three curved blades around a hub
 *   dome  - UFO-like dome with a ring skirt
 *   star  - five-pointed star body
 * a / b: primary and secondary colour. glow: emissive aura in-game.
 * dmg: damage per hit in battle, and power per hit while training.
 * hp: health in battle.
 *
 * Inside a capsule the four spinners are roughly x1, x1.35, x1.9 and x3 the tier's
 * base damage; each capsule tier is ~x4.3 the previous one and costs ~x8 the wins,
 * which lines up with stage rewards doubling every stage (3 stages = x8 wins).
 * ------------------------------------------------------------------------- */

const S = (id, name, rarity, family, a, b, dmg, hp, extra = {}) => ({
  id,
  name,
  rarity,
  family,
  a,
  b,
  dmg,
  hp,
  glow: false,
  scale: 1,
  ...extra,
})

const SPINNER_LIST = [
  // Starter
  S('rookie', 'Rookie Spinner', 'common', 'dome', '#3aa0ff', '#ffffff', 2, 100),

  // Basic Capsule
  S('basic', 'Basic Spinner', 'common', 'disc', '#2a8cff', '#8fd0ff', 2, 25),
  S('aqua_saw', 'Aqua Saw', 'common', 'saw', '#19c6d6', '#c9faff', 3, 34),
  S('sky_blade', 'Sky Blade', 'uncommon', 'blade', '#4a7dff', '#d6e4ff', 4, 48),
  S('lime_star', 'Lime Star', 'rare', 'star', '#8fdf1f', '#f4ff7a', 6, 74),

  // Common Capsule
  S('jade_whirl', 'Jade Whirl', 'uncommon', 'disc', '#1fbf6a', '#bfffd8', 9, 108),
  S('candy_twist', 'Candy Twist', 'uncommon', 'star', '#ff6ad5', '#ffe36a', 12, 145),
  S('coral_dome', 'Coral Dome', 'rare', 'dome', '#ff7b54', '#ffe0b5', 17, 205),
  S('toxic_saw', 'Toxic Saw', 'epic', 'saw', '#6dff2e', '#1f4a0c', 27, 325),

  // Rare Capsule
  S('storm_blade', 'Storm Blade', 'rare', 'blade', '#3f6bff', '#9ffcff', 40, 480),
  S('sun_disc', 'Sun Disc', 'rare', 'disc', '#ffc21a', '#fff3b0', 54, 650),
  S('royal_star', 'Royal Star', 'epic', 'star', '#ffd34d', '#c0102a', 76, 910),
  S('violet_fang', 'Violet Fang', 'legendary', 'saw', '#9b30ff', '#ff9cf0', 120, 1440, {
    glow: true,
  }),

  // Epic Capsule
  S('frost_core', 'Frost Core', 'epic', 'dome', '#8fe9ff', '#ffffff', 170, 2050),
  S('ember_saw', 'Ember Saw', 'epic', 'saw', '#ff5a1f', '#ffd000', 230, 2760),
  S('emerald_titan', 'Emerald Titan', 'legendary', 'disc', '#0fbf5f', '#e8ffef', 320, 3850),
  S('void_star', 'Void Star', 'mythic', 'star', '#3a0f6a', '#c04dff', 510, 6100, { glow: true }),

  // Legendary Capsule
  S('thunder_god', 'Thunder God', 'legendary', 'blade', '#ffe14d', '#3d7bff', 700, 8400),
  S('magma_king', 'Magma King', 'legendary', 'saw', '#ff3b00', '#3a1200', 950, 11400),
  S('celestia', 'Celestia', 'mythic', 'dome', '#ffffff', '#7ad7ff', 1330, 16000, { glow: true }),
  S('prism_core', 'Prism Core', 'secret', 'star', '#ff4df0', '#4dfff6', 2100, 25200, {
    glow: true,
  }),

  // Mythic Capsule
  S('dragon_fury', 'Dragon Fury', 'mythic', 'saw', '#d60000', '#ffcc00', 3000, 36000),
  S('galaxy_core', 'Galaxy Core', 'mythic', 'disc', '#3b1cff', '#ff4df0', 4050, 48600, {
    glow: true,
  }),
  S('phoenix_blade', 'Phoenix Blade', 'mythic', 'blade', '#ff7a00', '#fff06a', 5700, 68400, {
    glow: true,
  }),
  S('omega', 'Omega', 'secret', 'star', '#161616', '#ff1f5a', 9000, 108000, { glow: true }),

  // Celestial Capsule
  S('nebula_dome', 'Nebula Dome', 'mythic', 'dome', '#7a2cff', '#2cf3ff', 13000, 156000, {
    glow: true,
  }),
  S('solar_saw', 'Solar Saw', 'mythic', 'saw', '#ffb000', '#ffffff', 17500, 210000, {
    glow: true,
  }),
  S('astral_blade', 'Astral Blade', 'secret', 'blade', '#00ffd0', '#ff00c8', 24700, 296000, {
    glow: true,
  }),
  S('cosmic_god', 'Cosmic God', 'secret', 'star', '#0b0b1a', '#ffffff', 39000, 468000, {
    glow: true,
  }),

  // Godly Capsule
  S('titan_x', 'Titan X', 'mythic', 'disc', '#ff2a2a', '#1a1a1a', 55000, 660000, { glow: true }),
  S('abyss_saw', 'Abyss Saw', 'mythic', 'saw', '#0a1a4a', '#3dffb5', 74000, 888000, {
    glow: true,
  }),
  S('seraph', 'Seraph', 'secret', 'blade', '#fff7d6', '#ffcf3d', 104000, 1250000, {
    glow: true,
  }),
  S('infinity', 'Infinity', 'secret', 'star', '#000000', '#7df9ff', 165000, 1980000, {
    glow: true,
  }),

  // Exclusive Capsule
  S('neon_viper', 'Neon Viper', 'epic', 'saw', '#00ff9d', '#00402c', 330, 3950),
  S('cyber_disc', 'Cyber Disc', 'legendary', 'disc', '#00e5ff', '#ff00aa', 480, 5750, {
    glow: true,
  }),
  S('shadow_reaper', 'Shadow Reaper', 'mythic', 'blade', '#1b1b1b', '#ff2a2a', 1400, 16800, {
    glow: true,
  }),
  S('golden_emperor', 'Golden Emperor', 'secret', 'star', '#ffd700', '#fff8d0', 3500, 42000, {
    glow: true,
  }),

  // Shop
  S('crystal', 'Crystal Spinner', 'mythic', 'blade', '#b06bff', '#7df9ff', 2400, 28800, {
    glow: true,
    scale: 1.15,
  }),
]

export const SPINNERS = Object.fromEntries(SPINNER_LIST.map((s) => [s.id, s]))
export const SPINNER_IDS = SPINNER_LIST.map((s) => s.id)

/** Five identical spinners craft into one golden copy with these stat multipliers. */
export const GOLDEN = {
  craftCount: 5,
  statMult: 2.5,
}

/* ---------------------------------------------------------------------------
 * The Spinners Shop
 *
 * Every spinner is bought directly: pick the one you want and pay its price in wins
 * at its pad in the lobby's Spinners Shop or from the Shop
 * button. No random capsules. The tiers keep the ids, colours, lobby spots and rebirth
 * locks the old capsules had (so code still calls them "capsules"); a spinner's price
 * is what it used to cost on average through its capsule - capsule price / drop chance
 * - so the game is paced as before. `weight` is that old drop chance.
 * ------------------------------------------------------------------------- */

/** Two significant figures, so prices read well: 7.5 -> 8, 1333 -> 1300. */
function nicePrice(v) {
  const step = 10 ** Math.max(0, Math.floor(Math.log10(v)) - 1)
  return Math.round(v / step) * step
}

const C = (id, name, currency, capsulePrice, rebirths, drops, color) => {
  const items = drops.map(([spinner, weight]) => ({ spinner, cost: nicePrice((capsulePrice * 100) / weight) }))
  return {
    id,
    name,
    currency,
    /** The cheapest spinner here ("from 8 Wins"). */
    cost: Math.min(...items.map((it) => it.cost)),
    rebirths,
    items,
    color,
  }
}

export const CAPSULE_LIST = [
  C('basic', 'Basic Spinners', 'wins', 3, 0, [
    ['basic', 40],
    ['aqua_saw', 30],
    ['sky_blade', 20],
    ['lime_star', 10],
  ], '#4fb4ff'),
  C('common', 'Common Spinners', 'wins', 25, 0, [
    ['jade_whirl', 45],
    ['candy_twist', 30],
    ['coral_dome', 15],
    ['toxic_saw', 10],
  ], '#3ddc6a'),
  C('rare', 'Rare Spinners', 'wins', 200, 0, [
    ['storm_blade', 50],
    ['sun_disc', 25],
    ['royal_star', 15],
    ['violet_fang', 10],
  ], '#2f7bff'),
  C('epic', 'Epic Spinners', 'wins', 1500, 1, [
    ['frost_core', 50],
    ['ember_saw', 30],
    ['emerald_titan', 15],
    ['void_star', 5],
  ], '#b45cff'),
  C('exclusive', 'Exclusive Spinners', 'wins', 6000, 2, [
    ['neon_viper', 60],
    ['cyber_disc', 35],
    ['shadow_reaper', 4],
    ['golden_emperor', 1],
  ], '#ff3df2'),
  C('legendary', 'Legendary Spinners', 'wins', 12000, 3, [
    ['thunder_god', 50],
    ['magma_king', 30],
    ['celestia', 17],
    ['prism_core', 3],
  ], '#ffb321'),
  C('mythic', 'Mythic Spinners', 'wins', 100000, 5, [
    ['dragon_fury', 50],
    ['galaxy_core', 30],
    ['phoenix_blade', 17],
    ['omega', 3],
  ], '#ff3d6e'),
  C('celestial', 'Celestial Spinners', 'wins', 900000, 8, [
    ['nebula_dome', 50],
    ['solar_saw', 32],
    ['astral_blade', 15],
    ['cosmic_god', 3],
  ], '#7a2cff'),
  C('godly', 'Godly Spinners', 'wins', 8000000, 12, [
    ['titan_x', 50],
    ['abyss_saw', 32],
    ['seraph', 15],
    ['infinity', 3],
  ], '#ffe14d'),
]

export const CAPSULES = Object.fromEntries(CAPSULE_LIST.map((c) => [c.id, c]))

/** spinner id -> { tier, cost, currency, rebirths }: everything the shop sells. */
export const SHOP_ITEMS = Object.fromEntries(
  CAPSULE_LIST.flatMap((t) => t.items.map((it) => [it.spinner, { tier: t.id, cost: it.cost, currency: t.currency, rebirths: t.rebirths }])),
)

/** The Crystal Spinner on its pedestal: a direct purchase. */
export const CRYSTAL_OFFER = { spinner: 'crystal', cost: 40000, rebirths: 4 }

/* ---------------------------------------------------------------------------
 * Training rings
 *
 * Each ring multiplies power gained while training in it. Unlocked by rebirths, the
 * way the original's "REBIRTH 1 x1.5 POWER" rings are.
 * ------------------------------------------------------------------------- */

export const RING_LIST = [
  { id: 'beginner', name: 'Beginner', mult: 1, rebirths: 0, color: '#4fa3ff', dummy: '#9aa7b8' },
  { id: 'bronze', name: 'Bronze', mult: 1.5, rebirths: 1, color: '#c8743a', dummy: '#e3a06b' },
  { id: 'silver', name: 'Silver', mult: 2, rebirths: 2, color: '#b9c6d6', dummy: '#eef3f8' },
  { id: 'gold', name: 'Gold', mult: 3, rebirths: 4, color: '#ffc21a', dummy: '#fff1a8' },
  { id: 'emerald', name: 'Emerald', mult: 5, rebirths: 6, color: '#1fd17a', dummy: '#b6ffd8' },
  { id: 'lava', name: 'Lava', mult: 8, rebirths: 9, color: '#ff4a12', dummy: '#ffb36b' },
  { id: 'galaxy', name: 'Galaxy', mult: 12, rebirths: 13, color: '#8a3dff', dummy: '#e0c8ff' },
  { id: 'godly', name: 'Godly', mult: 20, rebirths: 18, color: '#ffe14d', dummy: '#ffffff' },
]

export const RINGS = Object.fromEntries(RING_LIST.map((r) => [r.id, r]))

/* ---------------------------------------------------------------------------
 * Trails (bought once with wins, permanent; one equipped)
 * speed: walk speed bonus. power: training power multiplier.
 * ------------------------------------------------------------------------- */

export const TRAIL_LIST = [
  { id: 'orange', name: 'Orange Trail', cost: 10, rebirths: 0, speed: 0.05, power: 1.1, colors: ['#ff9a1f', '#ffd34d'] },
  { id: 'green', name: 'Green Trail', cost: 50, rebirths: 0, speed: 0.1, power: 1.2, colors: ['#1fdc4a', '#b6ff6a'] },
  { id: 'blue', name: 'Blue Trail', cost: 300, rebirths: 0, speed: 0.15, power: 1.35, colors: ['#1f7bff', '#7df9ff'] },
  { id: 'purple', name: 'Purple Trail', cost: 2500, rebirths: 1, speed: 0.2, power: 1.5, colors: ['#9b30ff', '#ff9cf0'] },
  { id: 'red', name: 'Red Trail', cost: 20000, rebirths: 3, speed: 0.25, power: 1.75, colors: ['#ff1f3d', '#ffb36b'] },
  { id: 'gold', name: 'Golden Trail', cost: 150000, rebirths: 5, speed: 0.3, power: 2, colors: ['#ffd700', '#fff8d0'] },
  { id: 'rainbow', name: 'Rainbow Trail', cost: 1500000, rebirths: 8, speed: 0.4, power: 2.5, colors: ['#ff1f3d', '#ffd700', '#1fdc4a', '#1f7bff', '#9b30ff'] },
  { id: 'galaxy', name: 'Galaxy Trail', cost: 15000000, rebirths: 12, speed: 0.5, power: 3, colors: ['#3b1cff', '#ff4df0', '#7df9ff'] },
]

export const TRAILS = Object.fromEntries(TRAIL_LIST.map((t) => [t.id, t]))

/* ---------------------------------------------------------------------------
 * Auras (bought once, permanent; one equipped)
 * wins: multiplier on wins from stages. dmg / hp: battle stat multipliers.
 * ------------------------------------------------------------------------- */

export const AURA_LIST = [
  { id: 'spark', name: 'Spark Aura', currency: 'wins', cost: 150, rebirths: 1, wins: 1.25, dmg: 1, hp: 1, color: '#7df9ff' },
  { id: 'flame', name: 'Flame Aura', currency: 'wins', cost: 4000, rebirths: 2, wins: 1.5, dmg: 1.1, hp: 1, color: '#ff6a1f' },
  { id: 'frost', name: 'Frost Aura', currency: 'wins', cost: 40000, rebirths: 4, wins: 2, dmg: 1.1, hp: 1.15, color: '#9fe8ff' },
  { id: 'storm', name: 'Storm Aura', currency: 'wins', cost: 500000, rebirths: 7, wins: 2.5, dmg: 1.2, hp: 1.2, color: '#ffe14d' },
  { id: 'shadow', name: 'Shadow Aura', currency: 'wins', cost: 6000000, rebirths: 10, wins: 3.5, dmg: 1.25, hp: 1.25, color: '#7a2cff' },
  { id: 'divine', name: 'Divine Aura', currency: 'wins', cost: 60000000, rebirths: 15, wins: 5, dmg: 1.4, hp: 1.4, color: '#fff2b0' },
]

export const AURAS = Object.fromEntries(AURA_LIST.map((a) => [a.id, a]))

/* ---------------------------------------------------------------------------
 * Potions (earned from gifts, quests and daily rewards - never bought)
 * ------------------------------------------------------------------------- */

export const POTIONS = {
  power: { id: 'power', name: '2x Power', icon: '💪', minutes: 10, desc: 'Double training power' },
  wins: { id: 'wins', name: '2x Wins', icon: '🏆', minutes: 10, desc: 'Double wins from stages' },
  lucky: { id: 'lucky', name: 'Lucky', icon: '🍀', minutes: 10, desc: 'Spinners cost 25% less' },
}

/* ---------------------------------------------------------------------------
 * Rebirth perks: the free replacements for the original's paid passes.
 * ------------------------------------------------------------------------- */

export const REBIRTH_PERKS = [
  { rebirths: 1, id: 'bronzeRing', name: 'Bronze Ring + Epic Capsule', desc: 'x2 training ring and a new capsule' },
  { rebirths: 2, id: 'lavaWorld', name: 'Lava World', desc: 'Unlocks Lava World (after Stage 10)' },
  { rebirths: 3, id: 'autoWin', name: 'AUTO WIN', desc: 'Auto-battle through stages' },
  { rebirths: 5, id: 'power2x', name: '2X POWER', desc: 'Permanent x2 training power' },
  { rebirths: 6, id: 'slot1', name: '+1 Spinner Slot', desc: 'Equip one more spinner' },
  { rebirths: 7, id: 'galaxyWorld', name: 'Galaxy World', desc: 'Unlocks Galaxy World (after Stage 20)' },
  { rebirths: 10, id: 'wins2x', name: '2X WINS', desc: 'Permanent x2 wins' },
  { rebirths: 14, id: 'slot2', name: '+1 Spinner Slot', desc: 'Equip one more spinner' },
  { rebirths: 20, id: 'slot3', name: '+1 Spinner Slot', desc: 'Equip one more spinner' },
]

/* ---------------------------------------------------------------------------
 * Worlds and stages
 *
 * Stages are numbered globally (Grassland 1-10, Lava 11-20, Galaxy 21-30) so enemy
 * strength and rewards are one continuous curve.
 * ------------------------------------------------------------------------- */

export const WORLD_LIST = [
  {
    id: 'grassland',
    name: 'Grassland',
    // Grassland's stages run straight out of the lobby, in front of the spawn.
    zone: 'lobby',
    firstStage: 1,
    stageCount: 10,
    rebirths: 0,
    requiresStage: 0,
    enemy: { a: '#e8202a', b: '#f2f2f2', boss: '#ff3b3b' },
    theme: 'grass',
  },
  {
    id: 'lava',
    name: 'Lava Land',
    firstStage: 11,
    stageCount: 10,
    rebirths: 2,
    requiresStage: 10,
    enemy: { a: '#ff5a00', b: '#2a0d00', boss: '#ffb000' },
    theme: 'lava',
  },
  {
    id: 'galaxy',
    name: 'Galaxy',
    firstStage: 21,
    stageCount: 10,
    rebirths: 7,
    requiresStage: 20,
    enemy: { a: '#6a00ff', b: '#00e5ff', boss: '#ff4df0' },
    theme: 'galaxy',
  },
]

export const WORLDS = Object.fromEntries(WORLD_LIST.map((w) => [w.id, w]))

/** Names the enemy trainer shouts at the start and end of a battle. */
export const TRAINER_LINES = {
  start: ["You're going down!", 'Spinners, ATTACK!', 'Prepare to lose!', "Let's spin!"],
  playerWon: ["I can't believe I lost!", 'WHAAAT?! NOOO!', 'How did I lose?!', 'Waaah my winning streak!'],
  playerLost: ['Too easy!', 'Train harder!', 'Better luck next time!', 'HAHA! Get stronger!'],
}

/* ---------------------------------------------------------------------------
 * Playtime gifts (minutes of play today) and daily login rewards
 *
 * `wins` rewards scale with the player's best stage so they stay worth claiming.
 * ------------------------------------------------------------------------- */

export const GIFTS = [
  { id: 'g1', minutes: 1, reward: { wins: 0.5 } },
  { id: 'g2', minutes: 3, reward: { potion: 'power' } },
  { id: 'g3', minutes: 6, reward: { wins: 1 } },
  { id: 'g4', minutes: 10, reward: { wins: 1.5 } },
  { id: 'g5', minutes: 15, reward: { potion: 'lucky' } },
  { id: 'g6', minutes: 20, reward: { wins: 2 } },
  { id: 'g7', minutes: 30, reward: { potion: 'wins' } },
  { id: 'g8', minutes: 45, reward: { wins: 4 } },
  { id: 'g9', minutes: 60, reward: { potion: 'power', wins: 3 } },
  { id: 'g10', minutes: 90, reward: { wins: 8, potion: 'lucky' } },
]

export const DAILY_REWARDS = [
  { day: 1, reward: { wins: 1 } },
  { day: 2, reward: { potion: 'power' } },
  { day: 3, reward: { wins: 3 } },
  { day: 4, reward: { potion: 'lucky' } },
  { day: 5, reward: { wins: 4 } },
  { day: 6, reward: { potion: 'wins', wins: 3 } },
  { day: 7, reward: { wins: 10, potion: 'lucky' } },
]

/* ---------------------------------------------------------------------------
 * Misc tuning
 * ------------------------------------------------------------------------- */

export const LIMITS = {
  inventory: 150,
  maxLevel: 400,
  /** Server cap on clicks per second (anything above is ignored, not punished). */
  clicksPerSecond: 10,
}
