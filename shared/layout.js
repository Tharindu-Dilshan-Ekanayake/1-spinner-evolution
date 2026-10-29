import { CAPSULE_LIST, RING_LIST, WORLDS } from './content.js'

/**
 * Where everything sits in the world, in world units (the player is ~1.8 tall).
 *
 * Shared so the server can validate positions ("is this player actually standing in
 * the Gold ring?") with the exact numbers the client draws with.
 *
 * The lobby, seen from the spawn point (facing -Z):
 *
 *            ... Stage 3 gate
 *                Stage 2 gate      <- the stages run away in one straight line
 *                Stage 1 gate         (Grassland lives in the lobby itself)
 *   WORLDS portal
 *   SPINNERS SHOP    SPAWN        LEADERBOARDS
 *   (a pad per spinner)  |
 *                TRAIN POWER
 *          the training rings in a row
 *     (stone mountains all round the island)
 *
 * The other worlds (Lava, Galaxy) are their own zones, entered through the
 * Worlds portal, and use exactly the same stage line in front of their spawn.
 */

export const PLAYER_RADIUS = 0.45
export const WALK_SPEED = 9
export const JUMP_SPEED = 9.5
export const GRAVITY = 26

/* ---------------------------------------------------------------------------
 * Stage line (identical in every zone)
 *
 * Seen walking forward (-Z) from the spawn, stage k is:
 *   gate k        z = gateZ(k)     glass door into stage k's area: open once stage
 *                                  k-1 is beaten (gate 1 is always open)
 *   blue pad      just past it     stand on it to start the fight; you stay on it
 *   arena k       z = arenaZ(k)
 *   red pad       far side         the enemy trainer
 *   platform k    before gate k+1  the yellow Return pad (cash out, back to lobby)
 * Walk around freely; only the blue pad starts a match. Winning opens the next gate;
 * losing puts you beside the blue pad to try again.
 * ------------------------------------------------------------------------- */

export const STAGE = {
  firstGateZ: -34,
  spacing: 58,
  arenaRadius: 12,
  wallRadius: 13.2,
  islandHalfWidth: 26,
  gateWidth: 18,
  gateHeight: 13,
  /** Blue (player) and red (enemy) pads are squares this wide. */
  padSize: 4.6,
  /** Pads are low steps you stand on: top of the blue/red pads, and of the Return pad. */
  padTop: 0.49,
  returnPadTop: 0.46,
  returnPadRadius: 2.6,
  /** Where every zone's players appear: facing the stage line. */
  spawn: { x: 0, y: 0, z: 0, ry: Math.PI },
  /** Door back to the lobby in the other worlds, beside the spawn, facing it. */
  exitPortal: { x: -14, y: 0, z: 2, ry: Math.PI / 2, width: 8, height: 9 },
}

export const gateZ = (k) => STAGE.firstGateZ - STAGE.spacing * (k - 1)
export const arenaZ = (k) => gateZ(k) - 22

/** Blue pad: where the player stands for stage k (between gate k and the arena). */
export function playerPad(k) {
  return { x: 0, y: 0, z: gateZ(k) - 6.5 }
}

/** Red pad: the enemy trainer, on the far side of arena k. */
export function enemyPad(k) {
  return { x: 0, y: 0, z: arenaZ(k) - 16 }
}

/** The Return pad on platform k (after beating stage k, before gate k+1). */
export function returnPad(k) {
  return { x: -7, y: 0, z: gateZ(k) - 50 }
}

/** Standing in front of gate k, facing it (outside stage k's area). */
export function gateFront(k) {
  return { x: 3, y: 0, z: gateZ(k) + 5, ry: Math.PI }
}

/** Beside stage k's blue pad, off it, facing the arena. Losing stage k puts you here. */
export function retrySpot(k) {
  return { x: 6, y: 0, z: gateZ(k) - 3, ry: Math.PI }
}

/** Gate k is open (walkable) once the run has beaten the stage before it. */
export const gateOpen = (k, cleared) => cleared >= k - 1

/** Gate k as a door (see Doors below). Its front faces the spawn (+Z). */
export function stageDoor(k) {
  return { x: 0, z: gateZ(k), ry: 0, width: STAGE.gateWidth, height: STAGE.gateHeight }
}

/** True when `p` is standing on stage k's blue pad. */
export function onPlayerPad(k, p, slack = 0) {
  const pad = playerPad(k)
  const half = STAGE.padSize / 2 + slack
  return Math.abs(p.x - pad.x) <= half && Math.abs(p.z - pad.z) <= half
}

/** Far end of the stage line's island for a world of `n` stages. */
export const lineEndZ = (n) => gateZ(n) - STAGE.spacing - 4

/** World whose stage line is in `zone` (the lobby hosts Grassland), or null. */
export function worldOfZone(zone) {
  if (zone === 'lobby') return 'grassland'
  return WORLDS[zone] && !WORLDS[zone].zone ? zone : null
}

/** Zone a world's stage line lives in. */
export function zoneOfWorld(worldId) {
  return WORLDS[worldId]?.zone || worldId
}

/* ---------------------------------------------------------------------------
 * Lobby
 * ------------------------------------------------------------------------- */

export const LOBBY = {
  spawn: STAGE.spawn,
  /** Walkable island: x/z bounds of the top surface (y = 0). Kept compact on purpose. */
  island: { minX: -56, maxX: 42, minZ: -34, maxZ: 48 },
  /** Ring dish radius; the wall around it is a little wider. */
  ringRadius: 4.6,
}

/**
 * Training rings: one row across the back of the lobby, in rebirth order from the left
 * as you walk back from the spawn. Each one's pad stands in front of it.
 */
export const TRAINING_ROW = { z: 36, spacing: 11.5, centreX: -7 }
export const RING_POSITIONS = Object.fromEntries(
  RING_LIST.map((ring, i) => [
    ring.id,
    { x: TRAINING_ROW.centreX + ((RING_LIST.length - 1) / 2 - i) * TRAINING_ROW.spacing, y: 0, z: TRAINING_ROW.z },
  ]),
)

/**
 * The training pad beside each ring, on the side facing the path: a low square step.
 * Standing on it is what trains at that ring.
 */
export const TRAIN_PAD = { size: 3.4, top: 0.2 }

export function trainPad(ringId) {
  const c = RING_POSITIONS[ringId]
  // In front of the ring, on the spawn's side.
  return { x: c.x, y: TRAIN_PAD.top, z: c.z - (LOBBY.ringRadius + 3) }
}

/**
 * The Spinners Shop, left of the spawn: two rows of tiers across your view, the
 * cheaper row in front and the rest behind it with an aisle between, and the Crystal
 * Spinner ending the back row.
 */
const SHOP_FRONT = ['basic', 'common', 'rare', 'epic', 'exclusive']
const SHOP_BACK = ['legendary', 'mythic', 'celestial', 'godly']
/** Row x (front, back) and the five slots along z, left to right as seen from the spawn. */
export const SHOP_LAYOUT = { frontX: -24, backX: -40, slots: [15, 7.5, 0, -7.5, -15] }
export const CAPSULE_POSITIONS = Object.fromEntries([
  ...SHOP_FRONT.map((id, i) => [id, { x: SHOP_LAYOUT.frontX, y: 0, z: SHOP_LAYOUT.slots[i] }]),
  ...SHOP_BACK.map((id, i) => [id, { x: SHOP_LAYOUT.backX, y: 0, z: SHOP_LAYOUT.slots[i] }]),
])

export const CRYSTAL_POSITION = { x: SHOP_LAYOUT.backX, y: 0, z: SHOP_LAYOUT.slots[4] }

/**
 * One pad per spinner for sale: each tier's four spinners stand on a 2x2 square of pads
 * where the tier sits, cheapest at the front-left as you walk up from the spawn. Stand
 * on a pad to buy the spinner spinning on it.
 */
export const SHOP_PAD = { radius: 1.6, spacing: 1.75, reach: 2.7 }
export const SHOP_PADS = CAPSULE_LIST.flatMap((tier) => {
  const c = CAPSULE_POSITIONS[tier.id]
  if (!c) return []
  // Facing the tier from the spawn: `front` points back at the spawn, `left` to its left.
  const fx = Math.abs(c.x) >= Math.abs(c.z) ? -Math.sign(c.x) : 0
  const fz = fx ? 0 : -Math.sign(c.z)
  const left = { x: -fz, z: fx }
  const s = SHOP_PAD.spacing
  return tier.items.slice(0, 4).map((it, i) => {
    const f = i < 2 ? s : -s
    const l = i % 2 === 0 ? s : -s
    return { id: it.spinner, tier: tier.id, x: c.x + fx * f + left.x * l, y: 0, z: c.z + fz * f + left.z * l }
  })
})

/** The spinner whose shop pad you're standing at, or null. */
export function shopPadNear(pos, reach = SHOP_PAD.reach) {
  let best = null
  let bestD = reach
  for (const pad of SHOP_PADS) {
    const d = dist2d(pos, pad)
    if (d < bestD) {
      bestD = d
      best = pad.id
    }
  }
  return best
}

/** The Worlds portal (Lava, Galaxy), front-left of the spawn, facing it. */
export const WORLDS_PORTAL = { x: -24, y: 0, z: -24, ry: 0, width: 8, height: 9 }

/** Leaderboards, right of the spawn, facing it. */
export const LEADERBOARD_POSITIONS = [
  { id: 'playtime', title: 'Most Playtime', x: 32, y: 0, z: -10, ry: -Math.PI / 2 },
  { id: 'rebirths', title: 'Most Rebirths', x: 34, y: 0, z: 1, ry: -Math.PI / 2 },
  { id: 'wins', title: 'Most Wins', x: 32, y: 0, z: 12, ry: -Math.PI / 2 },
]

/** Named spots the HUD can warp to inside the lobby (Shop / Worlds buttons). */
export const LOBBY_SPOTS = {
  spawn: STAGE.spawn,
  stages: { x: 0, y: 0, z: gateZ(1) + 6, ry: Math.PI },
  shop: { x: -14, y: 0, z: 0, ry: -Math.PI / 2 },
  training: { x: 0, y: 0, z: 20, ry: 0 },
  worlds: { x: WORLDS_PORTAL.x, y: 0, z: WORLDS_PORTAL.z + 6, ry: Math.PI },
}

/* ---------------------------------------------------------------------------
 * Doors
 *
 * A door is { x, z, ry, width, height, screen? }: an opening `width` wide and
 * `height` tall (to the underside of the lintel), in a frame of DOOR.pillar-thick
 * bricks. ry turns its front (local +Z) to face that way. When `screen` is set, the
 * top `screen` units of the opening hold a display and the rest is the doorway.
 * ------------------------------------------------------------------------- */

export const DOOR = { pillar: 1.6, depth: 1.6, screen: 4.4 }

/** Position of a world point in the door's own frame: x across, z through it. */
export function toDoorLocal(door, p) {
  const dx = p.x - door.x
  const dz = p.z - door.z
  const c = Math.cos(door.ry)
  const s = Math.sin(door.ry)
  return { x: dx * c - dz * s, z: dx * s + dz * c }
}

/** A world point at door-local (lx, lz). */
export function fromDoorLocal(door, lx, lz) {
  const c = Math.cos(door.ry)
  const s = Math.sin(door.ry)
  return { x: door.x + lx * c + lz * s, z: door.z - lx * s + lz * c }
}

/** True when `p` is standing in the doorway. */
export function inDoorway(door, p, depth = 1.4) {
  const l = toDoorLocal(door, p)
  return Math.abs(l.z) < depth && Math.abs(l.x) < door.width / 2 - 0.3
}

/** Where to put a player coming back out of a door: a few steps in front of it. */
export function doorExit(door, distance = 5) {
  const spot = fromDoorLocal(door, 0, distance)
  return { x: spot.x, y: 0, z: spot.z, ry: door.ry }
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

export function dist2d(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

/**
 * Ring whose training pad the player is standing on, or null. `slack` widens the pad
 * for the server, which only has the last reported position.
 */
export function ringAt(pos, slack = 0) {
  const half = TRAIN_PAD.size / 2 + slack
  for (const ring of RING_LIST) {
    const pad = trainPad(ring.id)
    if (Math.abs(pos.x - pad.x) <= half && Math.abs(pos.z - pad.z) <= half) return ring.id
  }
  return null
}

/** Capsule machine within reach, or null. */
export function capsuleNear(pos, reach = 5) {
  let best = null
  let bestD = reach
  for (const c of CAPSULE_LIST) {
    const p = CAPSULE_POSITIONS[c.id]
    if (!p) continue
    const d = dist2d(pos, p)
    if (d < bestD) {
      bestD = d
      best = c.id
    }
  }
  return best
}
