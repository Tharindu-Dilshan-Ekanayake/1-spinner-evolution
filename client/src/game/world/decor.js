import { Color } from 'three'

import { PALETTE } from '../sceneStyle'
import { boxMatrix } from './parts/builders'
import { crateBlocks, flowerBlocks, treeBlocks } from './parts/decorBlocks'

/* ---------------------------------------------------------------------------
 * Decor recipes per world (used by the lazy world modules)
 * ------------------------------------------------------------------------- */

export const DECOR = {
  grass(k, z) {
    const f = PALETTE.flowers
    return [
      ...treeBlocks(-19, z + 12, 0.8),
      ...treeBlocks(-19, z - 10, 0.7, [PALETTE.leaves[1], PALETTE.leaves[2], PALETTE.leaves[0]]),
      ...flowerBlocks(-14, z + 15, f[k % f.length]),
      ...flowerBlocks(-12, z + 16, f[(k + 2) % f.length]),
      ...flowerBlocks(21, z + 9, f[(k + 4) % f.length]),
      ...crateBlocks(-20, z - 2, 1.4, PALETTE.hedge),
      ...crateBlocks(-21, z - 0.6, 0.9, PALETTE.gold),
    ]
  },
  lava(k, z) {
    return [
      ...crateBlocks(-19, z + 10, 2, '#3a2a2a'),
      ...crateBlocks(-17.5, z + 11.5, 1, '#ff5a12'),
      ...crateBlocks(20, z + 8, 1.5, '#2a1d1d'),
      ...crateBlocks(-20, z - 9, 1.2, '#ff8a1c'),
      ...treeBlocks(-19, z - 2, 0.7, '#ff5a12', '#2a1d1d'),
    ]
  },
  galaxy(k, z) {
    return [
      ...crateBlocks(-19, z + 10, 1.6, '#2cf3ff'),
      ...crateBlocks(-20, z - 8, 1.1, '#ff4df0'),
      ...crateBlocks(20, z + 9, 1.3, '#8a3dff'),
      ...treeBlocks(-18, z, 0.75, '#8a3dff', '#1a1a3a'),
    ]
  },
}

/* ---------------------------------------------------------------------------
 * Stone mountains round the lobby: studded brick steps standing right on the island's
 * edge (they're its walls: nobody walks past them), each step's ledge a grassy plate
 * facing the lobby, with trees on them.
 * ------------------------------------------------------------------------- */

/** Stone by step, darker at the foot and lighter up high: a cool grey and a warm one. */
const STONE = [
  ['#8a909b', '#9ca2ac', '#b0b5be', '#c6cad1'],
  ['#958f88', '#a7a199', '#bab4ac', '#cfcac3'],
]
const LEDGE = ['#5fd146', '#6bd94f', '#55c63e']

/** Repeatable "random" in [0, 1) from a seed (same mountains every time). */
function rand(seed) {
  const v = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return v - Math.floor(v)
}

/** A small tree for the ledges: trunk, canopy and a top (three blocks). */
function ledgeTree(out, x, y, z, s, i) {
  const L = PALETTE.leaves
  out.push({ matrix: boxMatrix(x, y + 1.4 * s, z, 0.9 * s, 2.8 * s, 0.9 * s), color: PALETTE.trunk })
  out.push({ matrix: boxMatrix(x, y + 3.6 * s, z, 3.4 * s, 2.4 * s, 3.4 * s), color: L[i % 3] })
  out.push({ matrix: boxMatrix(x + 0.3 * s, y + 5.1 * s, z - 0.2 * s, 2.2 * s, 1.4 * s, 2.2 * s), color: L[(i + 1) % 3] })
}

/**
 * One mountain centred at (x, z), `inward` the unit direction towards the lobby. Steps
 * are measured as `a` (depth towards the lobby) and `l` (width across); each higher
 * one sits `back` further from the lobby, leaving a grassy ledge in front of it.
 */
const STEPS = [
  { a: 18, l: 24, h: 7, back: 0 },
  { a: 10, l: 16, h: 7, back: 5 },
  { a: 6, l: 10, h: 8, back: 8 },
  { a: 3.5, l: 5, h: 7, back: 9.5 },
]
/** Each step is two courses of bricks, the upper one set in a little, like stacked bricks. */
const COURSE_INSET = 0.3

function mountain(x, z, inward, s, seed, stone, trees) {
  const along = inward.x !== 0
  // Faces pointing away from the lobby are never seen: left out of the mesh.
  const hide = { x: -inward.x, z: -inward.z }
  const shades = STONE[seed % 2]
  // A tall peak or a short one, so the skyline goes up and down.
  const peak = 0.6 + rand(seed + 3) * 0.9
  let top = -14
  STEPS.forEach((st, i) => {
    const lateral = Math.round((rand(seed + i) - 0.5) * 3 * s)
    const cx = x - inward.x * st.back * s + inward.z * lateral
    const cz = z - inward.z * st.back * s - inward.x * lateral
    const bottom = top
    top = (i === 0 ? 0 : top) + st.h * s * (i === STEPS.length - 1 ? peak : 1)
    const w = (along ? st.a : st.l) * s
    const d = (along ? st.l : st.a) * s
    // The lower course reaches down below the island; the seam sits partway up.
    const mid = i === 0 ? top * 0.45 : (bottom + top) / 2
    stone.push({ x: cx, y: (bottom + mid) / 2, z: cz, w, h: mid - bottom, d, color: shades[i], hide })
    const k = COURSE_INSET * 2
    stone.push({ x: cx, y: (mid + top) / 2, z: cz, w: w - k, h: top - mid, d: d - k, color: shades[Math.min(3, i + 1)], hide })
    if (i >= 2) return
    // The grassy plate on top (overhanging the step, so no face is shared with it)...
    stone.push({ x: cx, y: top + 0.1, z: cz, w: w + 0.3, h: 0.6, d: d + 0.3, color: LEDGE[(seed + i) % LEDGE.length], hide })
    // ...and a tree on the strip the next step leaves open on the lobby side.
    const next = STEPS[i + 1]
    const front = (st.a / 2) * s
    const covered = (next.a / 2 - (next.back - st.back)) * s
    const t = (front + covered) / 2
    const side = (rand(seed + 7 + i) - 0.5) * st.l * s * 0.5
    ledgeTree(trees, cx + inward.x * t + inward.z * side, top + 0.4, cz + inward.z * t - inward.x * side, 0.9 * s, seed + i)
    // A boulder on the far end of the bottom ledge, from the tree.
    if (i === 0) {
      const b = (1.6 + rand(seed + 11) * 1.2) * s
      const bs = -Math.sign(side || 1) * st.l * s * 0.32
      stone.push({ x: cx + inward.x * t + inward.z * bs, y: top + 0.4 + b * 0.4, z: cz + inward.z * t - inward.x * bs, w: b, h: b * 0.8, d: b * 0.9, color: shades[1] })
    }
  })
}

/**
 * The range all round the lobby island (`island`: its walkable bounds), standing right
 * on its edges, with the front left open where the stage line runs out (|x| <
 * `stageHalfWidth`). Returns `stone` boxes for studdedBlocks, `trees` lobby blocks, and
 * `walls`: tall collider boxes along those edges, so nobody walks or jumps past.
 */
export function lobbyMountains(island, stageHalfWidth) {
  const stone = []
  const trees = []
  // Points along the island's edges, each with the way back into the lobby.
  const spots = []
  for (let x = island.minX - 6; x <= island.maxX + 6; x += 17) spots.push({ x, z: island.maxZ, inward: { x: 0, z: -1 } })
  for (let z = island.minZ - 4; z <= island.maxZ + 4; z += 17) {
    spots.push({ x: island.minX, z, inward: { x: 1, z: 0 } })
    spots.push({ x: island.maxX, z, inward: { x: -1, z: 0 } })
  }
  // The front either side of the stage line: one mountain filling each stretch.
  const fronts = [
    [island.minX, -stageHalfWidth],
    [stageHalfWidth, island.maxX],
  ]
  for (const [a, b] of fronts) {
    if (b - a > 4) spots.push({ x: (a + b) / 2, z: island.minZ, inward: { x: 0, z: 1 }, s: Math.min(1.3, (b - a) / STEPS[0].l) })
  }
  spots.forEach((p, i) => {
    // Big and smaller ones in turn.
    const s = p.s || (i % 2 ? 0.95 + rand(i * 3.7) * 0.25 : 1.15 + rand(i * 3.7) * 0.35)
    // The lobby face stands just inside the edge, so the mountain rises out of the
    // ground; neighbours alternate how far in, so their faces never share a plane.
    const inside = 0.3 + (i % 2) * 0.5
    const out = (STEPS[0].a / 2) * s - inside
    mountain(p.x - p.inward.x * out, p.z - p.inward.z * out, p.inward, s, i * 5 + 1, stone, trees)
  })
  const wall = (minX, maxX, minZ, maxZ) => ({ minX, maxX, minZ, maxZ, minY: -10, maxY: 80 })
  const { minX, maxX, minZ, maxZ } = island
  const walls = [
    wall(minX - 3, maxX + 3, maxZ - 1, maxZ + 3),
    wall(minX - 3, minX + 1, minZ - 3, maxZ + 3),
    wall(maxX - 1, maxX + 3, minZ - 3, maxZ + 3),
    wall(minX - 3, -stageHalfWidth, minZ - 3, minZ + 1),
    wall(stageHalfWidth, maxX + 3, minZ - 3, minZ + 1),
  ]
  return { stone, trees, walls }
}

/* ---------------------------------------------------------------------------
 * Spawn plazas of the other worlds: a walkway to Stage 1 lined with lamps, and the
 * world's own set pieces round it. One block set (one draw call) per world.
 * ------------------------------------------------------------------------- */

/** The plaza runs z 16 (behind the spawn) to -32 (Stage 1's gate); the Lobby door is at x -14, z 2. */
const WALK = { from: 13, to: -31, half: 4 }

function walkway(theme, out) {
  // A checker of the path colour and a lighter shade of it, like the lobby's spawn pad.
  const light = `#${new Color(theme.path).lerp(new Color('#ffffff'), 0.2).getHexString()}`
  for (let z = WALK.from; z > WALK.to; z -= 2) {
    for (let x = -WALK.half + 1; x < WALK.half; x += 2) {
      const even = (Math.round(x / 2) + Math.round(z / 2)) % 2 === 0
      out.push({ matrix: boxMatrix(x, 0.04, z - 1, 2, 0.08, 2), color: even ? light : theme.path })
    }
    for (const x of [-WALK.half - 0.5, WALK.half + 0.5]) out.push({ matrix: boxMatrix(x, 0.06, z - 1, 1, 0.12, 2), color: theme.pathEdge })
  }
}

/** A glow sprite to draw every frame (see StageWorld.jsx); `flat` lies on the ground. */
function glow(list, x, y, z, size, hex, a, flat = false) {
  const c = new Color(hex)
  list.push({ x, y, z, size, r: c.r, g: c.g, b: c.b, a, flat })
}

/** Lamp posts down both sides of the walkway; `cap` is the lit block's colour. */
function lamps(theme, cap, out, circles, glows) {
  for (const z of [8, -6, -20]) {
    for (const x of [-WALK.half - 2.2, WALK.half + 2.2]) {
      out.push({ matrix: boxMatrix(x, 0.3, z, 1.3, 0.6, 1.3), color: theme.edge })
      out.push({ matrix: boxMatrix(x, 2.3, z, 0.45, 3.4, 0.45), color: theme.wall })
      out.push({ matrix: boxMatrix(x, 4.25, z, 1, 0.5, 1), color: theme.edge })
      out.push({ matrix: boxMatrix(x, 4.85, z, 0.8, 0.7, 0.8), color: cap })
      out.push({ matrix: boxMatrix(x, 5.35, z, 1.05, 0.3, 1.05), color: theme.edge })
      circles.push({ x, z, r: 0.8, minY: -1, maxY: 6 })
      glow(glows, x, 4.85, z, 3.4, cap, 0.55)
      glow(glows, x, 0.1, z, 5, cap, 0.22, true)
    }
  }
}

/** A stepped pile of blocks (rock spire, crystal), tallest in the middle; its top glows. */
function spire(x, z, s, colors, out, circles, glows) {
  const c = (i) => colors[i % colors.length]
  out.push({ matrix: boxMatrix(x, 0.9 * s, z, 2.6 * s, 1.8 * s, 2.4 * s, 0.2), color: c(0) })
  out.push({ matrix: boxMatrix(x + 0.2 * s, 2.6 * s, z - 0.1 * s, 1.7 * s, 1.8 * s, 1.6 * s, -0.3), color: c(1) })
  out.push({ matrix: boxMatrix(x - 0.1 * s, 4.1 * s, z + 0.1 * s, 1 * s, 1.4 * s, 1 * s, 0.5), color: c(2) })
  out.push({ matrix: boxMatrix(x + 1.6 * s, 0.6 * s, z + 1.1 * s, 1.2 * s, 1.2 * s, 1.2 * s, 0.7), color: c(1) })
  circles.push({ x, z, r: 1.6 * s, minY: -1, maxY: 5 * s })
  glow(glows, x - 0.1 * s, 4.1 * s, z + 0.1 * s, 3.2 * s, c(2), 0.45)
}

/** A sunken pool (lava, starlight) in a raised rim; `fill` is what's in it, and glows. */
function pool(x, z, w, d, rim, fill, out, circles, glows) {
  out.push({ matrix: boxMatrix(x, 0.2, z, w - 1.2, 0.4, d - 1.2), color: fill })
  out.push({ matrix: boxMatrix(x, 0.3, z - d / 2 + 0.35, w, 0.6, 0.7), color: rim })
  out.push({ matrix: boxMatrix(x, 0.3, z + d / 2 - 0.35, w, 0.6, 0.7), color: rim })
  out.push({ matrix: boxMatrix(x - w / 2 + 0.35, 0.3, z, 0.7, 0.6, d - 1.4), color: rim })
  out.push({ matrix: boxMatrix(x + w / 2 - 0.35, 0.3, z, 0.7, 0.6, d - 1.4), color: rim })
  circles.push({ x, z, r: Math.min(w, d) / 2, minY: -1, maxY: 0.6 })
  glow(glows, x, 0.45, z, Math.max(w, d) * 1.15, fill, 0.55, true)
  glow(glows, x, 1.6, z, Math.max(w, d) * 0.9, fill, 0.3)
}

/** Per world: { blocks, circles, glows } for its spawn plaza (see StageWorld.jsx). */
export const PLAZA_DECOR = {
  lava(theme) {
    const blocks = []
    const circles = []
    const glows = []
    walkway(theme, blocks)
    lamps(theme, '#ffb000', blocks, circles, glows)
    pool(15, -6, 9, 7, '#2a1d1d', '#ff6a1a', blocks, circles, glows)
    pool(-16, -20, 8, 7, '#2a1d1d', '#ff8a1c', blocks, circles, glows)
    // A rock in the bigger pool.
    blocks.push({ matrix: boxMatrix(15, 0.45, -6, 2.2, 0.5, 1.6, 0.4), color: '#3a2a2a' })
    spire(19, 9, 1.1, ['#3a2a2a', '#2a1d1d', '#ff5a12'], blocks, circles, glows)
    spire(-20, -9, 0.9, ['#2a1d1d', '#4a3434', '#ff8a1c'], blocks, circles, glows)
    spire(20, -24, 1.2, ['#2a1d1d', '#3a2a2a', '#ff5a12'], blocks, circles, glows)
    spire(-20, 12, 0.8, ['#3a2a2a', '#2a1d1d', '#ffb000'], blocks, circles, glows)
    return { blocks, circles, glows }
  },
  galaxy(theme) {
    const blocks = []
    const circles = []
    const glows = []
    walkway(theme, blocks)
    lamps(theme, '#2cf3ff', blocks, circles, glows)
    pool(15, -6, 9, 7, '#151838', '#8a3dff', blocks, circles, glows)
    pool(-16, -20, 8, 7, '#151838', '#2cf3ff', blocks, circles, glows)
    spire(19, 9, 1.1, ['#2cf3ff', '#8a3dff', '#ff4df0'], blocks, circles, glows)
    spire(-20, -9, 0.9, ['#ff4df0', '#2cf3ff', '#ffffff'], blocks, circles, glows)
    spire(20, -24, 1.2, ['#8a3dff', '#ff4df0', '#2cf3ff'], blocks, circles, glows)
    spire(-20, 12, 0.8, ['#2cf3ff', '#ffffff', '#8a3dff'], blocks, circles, glows)
    // Cubes floating over the plaza, out of reach.
    for (const [x, y, z, s, c] of [
      [12, 9, 4, 1.4, '#2cf3ff'],
      [-11, 11, -14, 1.1, '#ff4df0'],
      [16, 12, -18, 0.9, '#ffffff'],
      [-17, 8, 6, 1, '#8a3dff'],
    ]) {
      blocks.push({ matrix: boxMatrix(x, y, z, s, s, s, x * 0.1), color: c })
    }
    return { blocks, circles, glows }
  },
}
