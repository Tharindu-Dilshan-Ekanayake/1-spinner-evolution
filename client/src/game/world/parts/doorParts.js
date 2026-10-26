import { Matrix4, Quaternion, Vector3 } from 'three'

import { DOOR, fromDoorLocal } from '@shared'

/**
 * Door geometry helpers (see Doors.jsx), kept out of the component module so worlds
 * can place signs and colliders on the same numbers.
 */

const _q = new Quaternion()
const _up = new Vector3(0, 1, 0)
const _p = new Vector3()
const _s = new Vector3()

/**
 * Matrix of a box at door-local (lx, y, lz) with size (w, h, d). Pass `out` to fill
 * an existing matrix (per-frame animation) instead of allocating one.
 */
export function doorBox(door, lx, y, lz, w, h, d, out = new Matrix4()) {
  const c = Math.cos(door.ry)
  const s = Math.sin(door.ry)
  _p.set(door.x + lx * c + lz * s, y, door.z - lx * s + lz * c)
  _q.setFromAxisAngle(_up, door.ry)
  _s.set(w, h, d)
  return out.compose(_p, _q, _s)
}

/** Height of the walk-through part of the doorway (below any top display). */
export const doorwayHeight = (door) => door.height - (door.screen || 0)

/** The sign on a door's display (top screen, or the board hung in the opening). */
export function doorScreenSign(door, draw) {
  if (door.board) {
    const at = fromDoorLocal(door, 0, 0.27)
    return { x: at.x, y: door.board.y, z: at.z, ry: door.ry, w: door.board.w - 0.2, h: door.board.h - 0.2, draw }
  }
  const at = fromDoorLocal(door, 0, DOOR.depth / 2 + 0.08)
  return {
    x: at.x,
    y: door.height - door.screen / 2,
    z: at.z,
    ry: door.ry,
    w: door.width - 0.3,
    h: door.screen - 0.3,
    draw,
  }
}

/**
 * Colliders for a door's two pillars (cylinders, so any angle works). The doorway in
 * between is left to the caller: a gate's glass, or nothing for a walk-in portal.
 */
export function doorPillarCircles(door) {
  const off = door.width / 2 + DOOR.pillar / 2
  return [-off, off].map((lx) => {
    const at = fromDoorLocal(door, lx, 0)
    return { x: at.x, z: at.z, r: DOOR.pillar * 0.75, minY: -1, maxY: door.height + DOOR.pillar }
  })
}
