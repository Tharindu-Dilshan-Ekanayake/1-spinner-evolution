import { DOOR, STAGE } from '@shared'

import { PALETTE } from '../../sceneStyle'
import { boxMatrix } from './builders'
import { stripedPillar } from './decorBlocks'

/**
 * Stage-line dressing, all box blocks for the stage's DecorBlocks draw call: stands full
 * of fans beside every arena, and the walls, flags and torches at every gate.
 */

const HALF = STAGE.islandHalfWidth
const GATE_HALF = STAGE.gateWidth / 2 + DOOR.pillar
/** Height of the castle walls either side of each gate. */
export const WALL_HEIGHT = 8

/**
 * Striped pilasters along each castle wall (x, mirrored): by the gate, middle, outer
 * end. The end ones stand a little past the wall's ends, so no face lies on top of the
 * wall's end face (that flickers).
 */
export const PILASTER_X = [GATE_HALF + 0.85, (GATE_HALF + HALF) / 2, HALF - 0.85]
const PILASTER = { w: 2 }
/** Height of a pilaster shaft; its cap block sits on top. */
const PILASTER_TOP = WALL_HEIGHT + 1

/** Torches either side of every gate, in front of it (x is mirrored). */
export const TORCH = { x: GATE_HALF + 1.3, dz: 1.8, flameY: 3.5 }

/** Stands east of every arena, facing it (relative to the arena centre). */
export const BLEACHER = { front: 15.4, back: 23.8, minZ: -8, maxZ: 6, tiers: 3 }
const FAN_SHIRTS = ['#e8202a', '#1e6bff', '#ffd23a', '#21a84a', '#ff8a00', '#8a2be2', '#ffffff', '#ff4d9a', '#00b8d4', '#1a1a1a']
const FAN_PANTS = ['#1d2a5a', '#2b2b33', '#3b5ba8', '#4a3a2a', '#1a1a1a', '#5a6a7a']
const FAN_SKINS = ['#ffd2a6', '#f1c27d', '#e0ac69', '#c68642', '#8d5524']
const FAN_HAIR = ['#2b1a0e', '#111111', '#6b3e1f', '#d9a441', '#a33a12']
const FANS_PER_TIER = 4

/**
 * One fan, built like a little Bloxity avatar facing -X (towards the arena): legs in
 * trousers, a shirt with a chest print, arms (up when cheering), a head with eyes, and
 * hair or a cap. `r` picks the outfit and the pose.
 */
function fanBlocks(out, x, y, z, r) {
  const pick = (list, salt) => list[Math.floor(hash(r * 997 + salt) * list.length)]
  const shirt = pick(FAN_SHIRTS, 1)
  const pants = pick(FAN_PANTS, 2)
  const skin = pick(FAN_SKINS, 3)
  const print = shirt === '#ffffff' ? '#e8202a' : shirt === '#ffd23a' ? '#1d2a5a' : '#ffffff'
  // Legs, torso, print.
  for (const side of [-1, 1]) out.push({ matrix: boxMatrix(x, y + 0.33, z + side * 0.19, 0.38, 0.66, 0.36), color: pants })
  out.push({ matrix: boxMatrix(x, y + 0.99, z, 0.42, 0.66, 0.76), color: shirt })
  // Prints and eyes stand 6 cm proud: thinner layers flicker at a distance.
  out.push({ matrix: boxMatrix(x - 0.24, y + 1.06, z, 0.08, 0.22, 0.34), color: print })
  // Arms: both up (cheering), one up (waving) or both down.
  const pose = hash(r * 31 + 7)
  for (const side of [-1, 1]) {
    const up = pose > 0.45 || (pose > 0.25 && side === 1)
    const color = hash(r * 13 + 5) > 0.5 ? skin : shirt
    out.push({ matrix: boxMatrix(x, up ? y + 1.62 : y + 0.99, z + side * 0.54, 0.32, 0.66, 0.32), color })
  }
  // Head, eyes, then hair or a cap.
  out.push({ matrix: boxMatrix(x, y + 1.54, z, 0.42, 0.42, 0.42), color: skin })
  for (const side of [-1, 1]) out.push({ matrix: boxMatrix(x - 0.235, y + 1.58, z + side * 0.09, 0.07, 0.08, 0.06), color: '#1a1a24' })
  if (hash(r * 17 + 3) > 0.5) {
    out.push({ matrix: boxMatrix(x, y + 1.8, z, 0.46, 0.12, 0.46), color: shirt })
    out.push({ matrix: boxMatrix(x - 0.3, y + 1.76, z, 0.22, 0.05, 0.44), color: shirt })
  } else {
    // Set back from the face, so the hair's front never lies on the face's front.
    out.push({ matrix: boxMatrix(x + 0.035, y + 1.79, z, 0.46, 0.12, 0.46), color: pick(FAN_HAIR, 4) })
  }
}

function hash(n) {
  const v = Math.sin(n * 12.9898) * 43758.5453
  return v - Math.floor(v)
}

/** Stepped stands full of blocky fans (some with their arms up) watching arena k. */
export function bleacherBlocks(k, az, theme) {
  const out = []
  const { front, back } = BLEACHER
  const minZ = az + BLEACHER.minZ
  const len = BLEACHER.maxZ - BLEACHER.minZ
  const cz = minZ + len / 2
  for (let i = 0; i < BLEACHER.tiers; i += 1) {
    const x0 = front + i * 2.2
    // Each step is its own block (the last runs to the back wall), so no two blocks
    // share a face in different colours - that is what flickered.
    const x1 = i === BLEACHER.tiers - 1 ? back : x0 + 2.2
    const top = 0.8 * (i + 1)
    out.push({ matrix: boxMatrix((x0 + x1) / 2, top / 2, cz, x1 - x0, top, len), color: i % 2 ? theme.trim : theme.wall })
    out.push({ matrix: boxMatrix(x0 + 0.15, top + 0.04, cz, 0.3, 0.1, len), color: theme.trim })
    for (let j = 0; j < FANS_PER_TIER; j += 1) {
      const r = hash(k * 131 + i * 17 + j)
      const z = minZ + 2 + j * ((len - 4) / (FANS_PER_TIER - 1)) + (r - 0.5) * 0.8
      fanBlocks(out, x0 + 1.1, top, z, r)
    }
  }
  out.push({ matrix: boxMatrix(back + 0.3, 2, cz, 0.6, 4, len), color: theme.wall })
  out.push({ matrix: boxMatrix(back + 0.3, 4.2, cz, 0.7, 0.4, len + 0.2), color: theme.trim })
  return out
}

/** Flags on the outer pilasters of gate k, and torches either side of the gate. */
export function gateDressing(gz, theme) {
  const out = []
  for (const side of [-1, 1]) {
    // The flag stands on the outer pilaster's cap.
    const fx = side * PILASTER_X[2]
    out.push({ matrix: boxMatrix(fx, PILASTER_TOP + 3.4, gz, 0.22, 4.4, 0.22), color: '#e6e6e6' })
    out.push({ matrix: boxMatrix(fx - side * 1.1, PILASTER_TOP + 4.9, gz, 2, 1.2, 0.1), color: theme.banner })
    const tx = side * TORCH.x
    const tz = gz + TORCH.dz
    out.push({ matrix: boxMatrix(tx, 1.3, tz, 0.4, 2.6, 0.4), color: '#4a3a2a' })
    out.push({ matrix: boxMatrix(tx, 2.75, tz, 0.95, 0.35, 0.95), color: '#2a2a2a' })
    out.push({ matrix: boxMatrix(tx, 3.15, tz, 0.6, 0.55, 0.6), color: '#ff8a1a' })
    out.push({ matrix: boxMatrix(tx, 3.42, tz, 0.32, 0.5, 0.32), color: '#ffe14d' })
  }
  return out
}

/**
 * The walls either side of gate k, built like the lobby's TRAIN POWER arch: striped
 * pilasters with cap blocks, and between them navy panels set in the (blue) wall with a
 * light strip under them, a gold top and a row of lights facing the way you come from.
 */
export function wallDressing(gz, theme) {
  const out = []
  const colors = { base: theme.arenaWall, band: theme.band, body: theme.wall, cap: theme.trim }
  const len = HALF - GATE_HALF
  for (const side of [-1, 1]) {
    // Ends and sides well inside the 2 m pilasters it runs through (5 cm inside theirs,
    // they flickered), still overhanging the 1.6 m wall.
    out.push({ matrix: boxMatrix(side * (GATE_HALF + len / 2), WALL_HEIGHT + 0.15, gz, len - 0.2, 0.3, 1.75), color: theme.trim })
    for (let i = 0; i < 2; i += 1) {
      const a = PILASTER_X[i] + PILASTER.w / 2 + 0.5
      const b = PILASTER_X[i + 1] - PILASTER.w / 2 - 0.5
      const cx = side * ((a + b) / 2)
      const w = b - a
      out.push({ matrix: boxMatrix(cx, 4.5, gz, w, 4.6, 1.85), color: theme.arenaWall })
      out.push({ matrix: boxMatrix(cx, 1.75, gz, w + 0.2, 0.24, 1.9), color: theme.light })
      for (let x = a + 0.6, j = 0; x < b - 0.3; x += 1.2, j += 1) {
        out.push({ matrix: boxMatrix(side * x, 7.35, gz + 0.86, 0.3, 0.3, 0.16), color: j % 2 ? theme.trim : PALETTE.white })
      }
    }
    PILASTER_X.forEach((px, i) => {
      // Lit like the arch on the pilaster beside the gate; plain further out.
      out.push(...stripedPillar(side * px, gz, PILASTER_TOP, 'z', { width: PILASTER.w, lights: i === 0, colors }).blocks)
    })
  }
  return out
}
