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
 *   WINS SHOP        SPAWN        LEADERBOARDS
 *   (capsules)         |          (+ Halloween corner)
 *                TRAIN POWER
 *              rings either side
 *
 * The other worlds (Lava, Galaxy, Halloween) are their own zones, entered through the
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
 *   gate k        z = gateZ(k)     glass door: touch it to fight stage k
 *   blue pad      just past it     you stand here while your spinners fight
 *   arena k       z = arenaZ(k)
 *   red pad       far side         the enemy trainer
 *   platform k    before gate k+1  the yellow Return pad (cash out, back to lobby)
 * Winning opens gate k behind you; losing puts you back in front of gate k.
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

/** Standing in front of gate k, facing it. Losing stage k puts you here. */
export function gateFront(k) {
  return { x: 3, y: 0, z: gateZ(k) + 5, ry: Math.PI }
}

/** Gate k as a door (see Doors below). Its front faces the spawn (+Z). */
export function stageDoor(k) {
  return { x: 0, z: gateZ(k), ry: 0, width: STAGE.gateWidth, height: STAGE.gateHeight }
}

/** True when `p` is pressed up against the front of gate k's glass. */
export function nearGate(k, p, slack = 0) {
  const dz = p.z - gateZ(k)
  return dz > -0.5 - slack && dz < 3.5 + slack && Math.abs(p.x) < STAGE.gateWidth / 2 + slack
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
  /** Walkable island: x/z bounds of the top surface (y = 0). */
  island: { minX: -80, maxX: 80, minZ: -36, maxZ: 118 },
  /** Ring dish radius; the wall around it is a little wider. */
  ringRadius: 7.5,
}

/** Training rings: pairs either side of the path behind the spawn, best furthest back. */
export const RING_POSITIONS = Object.fromEntries(
  RING_LIST.map((ring, i) => [
    ring.id,
    { x: i % 2 === 0 ? -20 : 20, y: 0, z: 32 + Math.floor(i / 2) * 22 },
  ]),
)

/** The Wins Shop, left of the spawn: two rows of capsule machines along a carpet. */
const SHOP_ORDER = ['basic', 'common', 'rare', 'epic', 'exclusive', 'legendary', 'mythic', 'celestial', 'godly']
export const CAPSULE_POSITIONS = Object.fromEntries(
  SHOP_ORDER.map((id, i) => [id, { x: -30 - (i % 5) * 10, y: 0, z: i < 5 ? -9 : 9 }]),
)
CAPSULE_POSITIONS.halloween = { x: 38, y: 0, z: 42 }

export const CRYSTAL_POSITION = { x: -70, y: 0, z: 10 }

/** The Worlds portal (Lava, Galaxy, Halloween), front-left of the spawn, beside the gate. */
export const WORLDS_PORTAL = { x: -30, y: 0, z: -26, ry: 0, width: 8, height: 9 }

/** Leaderboards, right of the spawn, facing it. */
export const LEADERBOARD_POSITIONS = [
  { id: 'playtime', title: 'Most Playtime', x: 48, y: 0, z: -16, ry: -Math.PI / 2 },
  { id: 'rebirths', title: 'Most Rebirths', x: 50, y: 0, z: 0, ry: -Math.PI / 2 },
  { id: 'wins', title: 'Most Wins', x: 48, y: 0, z: 16, ry: -Math.PI / 2 },
]

/** Named spots the HUD can warp to inside the lobby (Shop / Worlds / Event buttons). */
export const LOBBY_SPOTS = {
  spawn: STAGE.spawn,
  stages: { x: 0, y: 0, z: gateZ(1) + 6, ry: Math.PI },
  shop: { x: -20, y: 0, z: 0, ry: -Math.PI / 2 },
  training: { x: 0, y: 0, z: 22, ry: 0 },
  worlds: { x: WORLDS_PORTAL.x, y: 0, z: WORLDS_PORTAL.z + 6, ry: Math.PI },
  halloween: { x: 30, y: 0, z: 34, ry: Math.PI / 4 },
}

/** Collectible pumpkins (Halloween candy). Respawn per player. */
export const PUMPKINS = [
  { id: 'p1', x: -10, z: 8 },
  { id: 'p2', x: 10, z: -12 },
  { id: 'p3', x: -28, z: 22 },
  { id: 'p4', x: -64, z: -22 },
  { id: 'p5', x: 32, z: -6 },
  { id: 'p6', x: -8, z: 64 },
  { id: 'p7', x: 8, z: 110 },
  { id: 'p8', x: 58, z: 54 },
  { id: 'p9', x: 26, z: 52 },
  { id: 'p10', x: -46, z: 30 },
  { id: 'p11', x: 62, z: -28 },
  { id: 'p12', x: -40, z: 100 },
]
export const PUMPKIN_RESPAWN_MS = 90 * 1000

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
 * Ring the player is training at, or null. Players can't step into the dish (its wall
 * blocks them), so "at" means standing against the wall; `slack` widens that for the
 * server, which only has the last reported position.
 */
export function ringAt(pos, slack = 0) {
  for (const ring of RING_LIST) {
    const c = RING_POSITIONS[ring.id]
    if (dist2d(pos, c) <= LOBBY.ringRadius + 3 + slack) return ring.id
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
