import { useEffect, useMemo } from 'react'
import { Color, MeshLambertMaterial } from 'three'

import {
  CAPSULES,
  CAPSULE_POSITIONS,
  CRYSTAL_OFFER,
  CRYSTAL_POSITION,
  DOOR,
  LEADERBOARD_POSITIONS,
  LOBBY,
  RARITIES,
  RINGS,
  RING_LIST,
  RING_POSITIONS,
  SHOP_LAYOUT,
  SPINNERS,
  STAGE,
  TRAIN_PAD,
  WORLDS_PORTAL,
  formatNumber,
  gateZ,
  trainPad,
} from '@shared'

import { gameState, useGameStore } from '../../store/gameStore'
import { live } from '../../store/live'
import { quality } from '../../store/qualityStore'
import { clearColliders, setColliders } from '../collision'
import { ORDER, useSystem } from '../loop'
import { SPRITE, fxBatch, shadowBatch } from '../render/fxBatch'
import { decalMaterial, getStudTexture, studMaterial } from '../render/materials'
import { PALETTE, THEMES } from '../sceneStyle'
import { FAMILIES } from '../spinners/spinnerGeometry'
import { customPalette, spinnerBatch, spinnerPalette } from '../spinners/spinnerBatch'
import { createWorldBoxGeometry } from '../textures'
import { DECOR, lobbyMountains } from './decor'
import { boxMatrix as boxBlock, mergedBoxes, studdedBlocks } from './parts/builders'
import { stripedPillar, treeBlocks } from './parts/decorBlocks'
import { doorPillarCircles, doorScreenSign } from './parts/doorParts'
import { Doors } from './parts/Doors'
import { Arenas } from './parts/Instanced'
import { Leaderboards } from './parts/Leaderboards'
import { PadFaces } from './parts/PadFaces'
import { CapsuleMachines } from './parts/Machines'
import { CRYSTAL_PAD_SCALE, STAND, dishHeight, shopPadList } from './parts/standParts'
import { DecorBlocks } from './parts/Props'
import { Signs } from './parts/Signs'
import { bannerText, boardSign, labelPanel } from './parts/signStyles'
import { ringFx } from './ringFx'
import StageLine from './StageLine'

/**
 * The hub, laid out compactly around the spawn point like the original:
 *
 *   in front    - the Stage 1 gate, with every Grassland stage lined up behind it
 *   behind      - TRAIN POWER: the arch, then the training rings in one row
 *   left        - the SPINNERS SHOP: a pad per spinner, the Crystal Spinner
 *   right       - the leaderboards
 *   front-left  - the Worlds portal (Lava, Galaxy)
 *   all round   - stone mountains (the front open for the stage line)
 */

const T = THEMES.lobby
const NO_SIGNS = []
const ISLAND = LOBBY.island
const CAPSULE_IDS = ['basic', 'common', 'rare', 'epic', 'exclusive', 'legendary', 'mythic', 'celestial', 'godly']
/**
 * Stone mountains on every edge of the island (the front left open for the stage line),
 * with trees on their ledges: studded like every other block, merged into one mesh (one
 * draw call); the trees join the lobby's blocks. They're the lobby's walls too.
 */
const MOUNTAINS = lobbyMountains(ISLAND, STAGE.islandHalfWidth)
let mountainMaterial = null
function getMountainMaterial() {
  if (!mountainMaterial) mountainMaterial = new MeshLambertMaterial({ map: getStudTexture(), vertexColors: true })
  return mountainMaterial
}

function Mountains() {
  const geometry = useMemo(() => studdedBlocks(MOUNTAINS.stone), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} material={getMountainMaterial()} receiveShadow />
}

/** Every pad in the Spinners Shop (one per spinner), the Crystal Spinner's included. */
const PADS = shopPadList(Object.fromEntries(CAPSULE_IDS.map((id) => [id, CAPSULES[id].color])))

/** Height of the path decals' surface, which is also the walkable floor. */
const PATH_TOP = 0.025

/** Rectangles as { minX, maxX, minZ, maxZ } -> slab boxes. */
const slab = (r, top, thick = 0.12, grow = 0) => ({
  x: (r.minX + r.maxX) / 2,
  y: top - thick / 2,
  z: (r.minZ + r.maxZ) / 2,
  w: r.maxX - r.minX + grow * 2,
  h: thick,
  d: r.maxZ - r.minZ + grow * 2,
})

const PATHS = [
  { minX: -12, maxX: 12, minZ: -12, maxZ: 12 }, // spawn plaza
  { minX: -7, maxX: 7, minZ: -34, maxZ: -12 }, // forward to the Stage 1 gate
  { minX: -6, maxX: 6, minZ: 12, maxZ: 22 }, // back to the training rings
  { minX: -50, maxX: 36, minZ: 22, maxZ: 27 }, // along the row of rings, in front of their pads
  { minX: -20, maxX: -12, minZ: -4, maxZ: 4 }, // left to the Spinners Shop
  { minX: 12, maxX: 28, minZ: -4, maxZ: 4 }, // right to the leaderboards
  { minX: -28, maxX: -12, minZ: -20, maxZ: -12 }, // to the Worlds portal
]
/**
 * The stretches of a rim line (along x when `alongX`, at the other coordinate `at`)
 * that no path crosses.
 */
function rimSegments(from, to, at, alongX) {
  let segments = [[from, to]]
  for (const r of PATHS) {
    const [lo, hi, a0, a1] = alongX ? [r.minX, r.maxX, r.minZ, r.maxZ] : [r.minZ, r.maxZ, r.minX, r.maxX]
    if (at < a0 - 0.25 || at > a1 + 0.25) continue
    segments = segments.flatMap(([s, e]) =>
      hi <= s || lo >= e ? [[s, e]] : [[s, Math.max(s, lo)], [Math.min(e, hi), e]].filter(([a, b]) => b - a > 0.01),
    )
  }
  return segments
}

/** The checkered spawn pad's square (see the lobby blocks). */
const SPAWN_PAD = { minX: -3, maxX: 3, minZ: -3, maxZ: 3 }

/** A rectangle minus the spawn pad: four rectangles round it. */
function aroundSpawnPad(r) {
  const p = SPAWN_PAD
  return [
    { minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: p.minZ },
    { minX: r.minX, maxX: r.maxX, minZ: p.maxZ, maxZ: r.maxZ },
    { minX: r.minX, maxX: p.minX, minZ: p.minZ, maxZ: p.maxZ },
    { minX: p.maxX, maxX: r.maxX, minZ: p.minZ, maxZ: p.maxZ },
  ]
}

/** The Spinners Shop's light-blue apron, under both rows of pads and the aisle between. */
const CARPET = { minX: -46, maxX: -19, minZ: -19, maxZ: 19 }

/** A few trees framing the edges; the middle stays open. */
const TREES = [
  [-50, -28], [-38, -30], [-52, 18], [39, 12], [38, -4], [22, -26], [34, -24],
]
const ARCH_Z = 16
/** The TRAIN POWER arch: pillar x, pillar height, centre of the board. */
const ARCH = { x: 8.5, top: 10.6, beamY: 8.2 }
/** The WINS SHOP board, behind the back row of machines, facing the spawn. */
const SHOP_BOARD_X = -50
/** Gold caps on the arch and WINS SHOP pillars (stripedPillar puts them 0.9 above the top). */
const PILLAR_CAPS = [
  { x: -ARCH.x, y: ARCH.top + 0.9, z: ARCH_Z },
  { x: ARCH.x, y: ARCH.top + 0.9, z: ARCH_Z },
  { x: SHOP_BOARD_X, y: 12.9, z: -11 },
  { x: SHOP_BOARD_X, y: 12.9, z: 11 },
]
/** The training pads' glossy face plates. */
const TRAIN_PAD_FACES = RING_LIST.map((ring) => ({ ...trainPad(ring.id), top: TRAIN_PAD.top, size: TRAIN_PAD.size, color: ring.color }))
const WORLDS_DOOR = { ...WORLDS_PORTAL, id: 'worlds', kind: 'portal', color: '#2cf3ff', screen: DOOR.screen }

/** What the spawn camera sees (it faces the stages): drawn before the first frame. */
function mainSigns() {
  return [
    { x: 0, y: 19.6, z: gateZ(1) + 1, ry: 0, w: 18, h: 3.2, draw: bannerText('BATTLE STAGES', ['#fff36b', '#ffb300'], '#3a1e00') },
    doorScreenSign(
      WORLDS_DOOR,
      boardSign(
        [
          { text: 'WORLDS', size: 0.5, fill: ['#ffffff', '#7df9ff'] },
          { text: 'Lava • Galaxy', size: 0.24, fill: '#bfe9ff' },
        ],
        { bg: '#1f3fa6', border: '#2cf3ff' },
      ),
    ),
  ]
}

/** The small floating labels (rings, shop stands): drawn just after the game starts. */
function labelSigns() {
  // Behind and beside the spawn view, so drawn just after the game opens: the arch
  // (both faces) and the WINS SHOP board.
  const signs = [
    { x: 0, y: ARCH.beamY, z: ARCH_Z - 0.5, ry: Math.PI, w: 15, h: 3, draw: bannerText('TRAIN POWER') },
    { x: 0, y: ARCH.beamY, z: ARCH_Z + 0.5, ry: 0, w: 15, h: 3, draw: bannerText('TRAIN POWER') },
    {
      x: SHOP_BOARD_X + 0.5,
      y: 9.2,
      z: 0,
      ry: Math.PI / 2,
      w: 19.4,
      h: 5.4,
      draw: boardSign(
        [
          { text: 'SPINNERS SHOP', size: 0.62, fill: ['#fff36b', '#ffb300'], stroke: '#5a1200' },
          { text: 'Pick a spinner and buy it with your wins!', size: 0.24 },
        ],
        { bg: '#e8243a', border: '#ffd400' },
      ),
    },
  ]
  for (const ring of RING_LIST) {
    const p = RING_POSITIONS[ring.id]
    const title = ring.rebirths ? `REBIRTH ${ring.rebirths}` : ring.name.toUpperCase()
    signs.push({ x: p.x, y: 5.2, z: p.z, w: 6.4, h: 2.2, billboard: true, far: 50, draw: labelPanel(title, `x${ring.mult} POWER`, { titleFill: ['#fff36b', '#ffb300'], subFill: '#ffffff', panel: 'rgba(16,20,40,0.35)' }) })
  }
  for (const id of CAPSULE_IDS) {
    const c = CAPSULES[id]
    const p = CAPSULE_POSITIONS[id]
    const price = `from ${formatNumber(c.cost)} Wins`
    const sub = c.rebirths ? `${price} • Rebirth ${c.rebirths}` : price
    const best = RARITIES[SPINNERS[c.items[c.items.length - 1].spinner].rarity]
    // The spinners spin down in the stands now, so the labels sit just above them; the
    // back row's ride higher, so they show over the front row from the spawn.
    const y = p.x === SHOP_LAYOUT.backX ? 7.2 : 4.1
    // Gone once you're at its pads, where each one's "[E] Buy" prompt says it all.
    signs.push({ x: p.x, y, z: p.z, w: 6.4, h: 2.2, billboard: true, far: 46, near: 14, draw: labelPanel(c.name, sub, { titleFill: [best.color, '#ffffff'], panel: 'rgba(16,20,40,0.4)' }) })
  }
  signs.push({ x: CRYSTAL_POSITION.x, y: 8.2, z: CRYSTAL_POSITION.z, w: 7, h: 2.4, billboard: true, far: 50, draw: labelPanel('Crystal Spinner', `${formatNumber(CRYSTAL_OFFER.cost)} Wins • Rebirth ${CRYSTAL_OFFER.rebirths}`, { titleFill: ['#e0b3ff', '#7df9ff'] }) })
  return signs
}

function useLobbyColliders() {
  useEffect(() => {
    const circles = []
    for (const ring of RING_LIST) {
      const p = RING_POSITIONS[ring.id]
      circles.push({ x: p.x, z: p.z, r: LOBBY.ringRadius + 1.3, minY: -2, maxY: 1.6 })
    }
    for (const p of PADS) circles.push({ x: p.x, z: p.z, r: STAND.radius * p.scale, minY: -1, maxY: 4 })
    for (const [x, z] of TREES) circles.push({ x, z, r: 0.75, minY: -1, maxY: 4 })
    circles.push(...doorPillarCircles(WORLDS_DOOR))
    const box = (x, z, w, d, maxY = 12) => ({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY: -1, maxY })
    const boxes = [
      // The TRAIN POWER arch's beam, above head height: you walk under it, but the
      // camera stops in front of it instead of passing through.
      { minX: -ARCH.x - 1, maxX: ARCH.x + 1, minZ: ARCH_Z - 0.6, maxZ: ARCH_Z + 0.6, minY: ARCH.beamY - 2.6, maxY: ARCH.top + 2 },
      box(-ARCH.x, ARCH_Z, 2.4, 2.4),
      box(ARCH.x, ARCH_Z, 2.4, 2.4),
      box(SHOP_BOARD_X, -11, 2.4, 2.4),
      box(SHOP_BOARD_X, 11, 2.4, 2.4),
      ...LEADERBOARD_POSITIONS.map((b) => box(b.x, b.z, 1.4, 9)),
      // The mountains round the edges: nobody walks (or jumps) off the island.
      ...MOUNTAINS.walls,
    ]
    setColliders('lobby', {
      // Feet rest on the paths' surface (they are thin decals 2.5 cm up); the training
      // pads are low steps.
      floors: [
        { minX: ISLAND.minX, maxX: ISLAND.maxX, minZ: ISLAND.minZ, maxZ: ISLAND.maxZ, top: PATH_TOP },
        ...RING_LIST.map((ring) => {
          const pad = trainPad(ring.id)
          const half = TRAIN_PAD.size / 2 + 0.3
          return { minX: pad.x - half, maxX: pad.x + half, minZ: pad.z - half, maxZ: pad.z + half, top: TRAIN_PAD.top }
        }),
      ],
      boxes,
      circles,
    })
    return () => clearColliders('lobby')
  }, [])
}

/**
 * The Spinners Shop: on every pad its spinner spins like a real top - fast, wobbling,
 * circling the middle of the dish - and the pad you're at lights up (stand there and
 * press E to buy). Drawn only near you (they're spinners: triangles add up; far ones
 * draw as cheap pucks anyway).
 */
const PRIZE_RANGE = 34
const SPINNER_SCALE = 0.72
const PRIZES = PADS.filter((p) => p.id !== 'crystal').map((p) => {
  const glow = new Color(p.color)
  const def = SPINNERS[p.id]
  return { ...p, glow: [glow.r, glow.g, glow.b], family: def.family, pal: spinnerPalette(p.id), rare: RARITIES[def.rarity].order >= 3 }
})
/** One soft ring in the tier's colour round each square of four pads. */
const TIER_RINGS = CAPSULE_IDS.map((id) => {
  const c = new Color(CAPSULES[id].color)
  return { ...CAPSULE_POSITIONS[id], glow: [c.r, c.g, c.b] }
})

function drawPrizes(t) {
  // Not before the game is up: ~20 spinners of every kind would build their meshes in
  // the very first frames and hold up the start (the labels wait the same way).
  const st = gameState()
  if (!st.settled) return
  const pl = live.player
  const at = st.nearby.shopPad
  for (let i = 0; i < PRIZES.length; i += 1) {
    const p = PRIZES[i]
    if (Math.abs(p.x - pl.x) > PRIZE_RANGE || Math.abs(p.z - pl.z) > PRIZE_RANGE) continue
    // Circles the middle of the dish, riding up its slope a little.
    const orbit = 0.12 + Math.sin(t * 0.7 + i) * 0.04
    const a = t * 1.9 + i
    const x = p.x + Math.cos(a) * orbit
    const z = p.z + Math.sin(a) * orbit
    spinnerBatch.push(p.family, x, dishHeight(orbit), z, t * 14 + i, 0.07, a + Math.PI / 2, SPINNER_SCALE, p.pal, p.rare ? 0.6 : 0.2, 0, false)
    if (p.id === at) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 5)
      fxBatch.push(p.x, 0.1, p.z, STAND.radius * 2.6 + pulse * 0.4, 1, 0.92, 0.4, 0.6 + pulse * 0.3, SPRITE.ring, true, t * 0.8)
      fxBatch.push(p.x, STAND.height + 0.5, p.z, 3, 1, 0.95, 0.6, 0.45, SPRITE.glow)
    }
  }
  for (let i = 0; i < TIER_RINGS.length; i += 1) {
    const r = TIER_RINGS[i]
    if (Math.abs(r.x - pl.x) > PRIZE_RANGE || Math.abs(r.z - pl.z) > PRIZE_RANGE) continue
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.6 + i)
    fxBatch.push(r.x, 0.06, r.z, 10 + pulse * 0.5, r.glow[0], r.glow[1], r.glow[2], 0.25 + pulse * 0.2, SPRITE.ring, true, t * 0.4)
  }
}

/** Training dummies in every ring, and the floating Crystal Spinner. */
function useLobbyDisplays() {
  useSystem(ORDER.world, (dt) => {
    const t = performance.now() * 0.001
    for (let i = 0; i < RING_LIST.length; i += 1) {
      const ring = RING_LIST[i]
      const p = RING_POSITIONS[ring.id]
      const rf = ringFx[ring.id]
      rf.flash = Math.max(0, rf.flash - dt * 5)
      rf.shake = Math.max(0, rf.shake - dt * 4)
      const sx = Math.sin(t * 55 + i) * 0.12 * rf.shake
      const pal = customPalette(`dummy:${ring.id}`, ring.dummy, ring.color)
      spinnerBatch.push(FAMILIES[i % FAMILIES.length], p.x + sx, 0.15, p.z, t * 1.5 + i, 0.05, t, 0.9, pal, ring.rebirths >= 6 ? 0.4 : 0, rf.flash, false)
      shadowBatch.push(p.x, 0.17, p.z, 2.1, 0, 0, 0.05, 0.4, SPRITE.glow, true)
      // The training pad pulses until you stand on it.
      if (live.ring !== ring.id) {
        const pad = trainPad(ring.id)
        const pulse = 0.5 + 0.5 * Math.sin(t * 3.2 + i)
        fxBatch.push(pad.x, TRAIN_PAD.top + 0.03, pad.z, TRAIN_PAD.size * (1.05 + pulse * 0.15), 1, 0.95, 0.6, 0.35 + pulse * 0.35, SPRITE.ring, true, t * 0.6)
      }
    }

    drawPrizes(t)

    const c = CRYSTAL_POSITION
    const bob = Math.sin(t * 1.6) * 0.25
    const pal = spinnerPalette('crystal')
    spinnerBatch.push(SPINNERS.crystal.family, c.x, 2.5 + bob, c.z, t * 2.2, 0.35, t * 0.7, 1.7, pal, 1, 0, false)
    fxBatch.push(c.x, 3.2 + bob, c.z, 7, pal.a.r, pal.a.g, pal.a.b, 0.55, SPRITE.glow)
    // A warm glow round each pillar's gold cap, like the slide game's lit arch.
    if (quality().glow) {
      const pulse = 0.4 + Math.sin(t * 2.4) * 0.1
      for (let i = 0; i < PILLAR_CAPS.length; i += 1) {
        const cap = PILLAR_CAPS[i]
        fxBatch.push(cap.x, cap.y, cap.z, 4.2, 1, 0.82, 0.25, pulse, SPRITE.glow)
      }
    }
    fxBatch.push(c.x, 3 + bob, c.z, 5.5, pal.b.r, pal.b.g, pal.b.b, 0.7, SPRITE.ring, false, t)
    shadowBatch.push(c.x, dishHeight(0) * CRYSTAL_PAD_SCALE + 0.02, c.z, 3, 0, 0, 0.05, 0.3, SPRITE.glow, true)
  })
}

export default function Lobby() {
  // Leaderboards and small labels are the slowest signs to draw; they can wait until
  // the player is in.
  const settled = useGameStore((s) => s.settled)
  const playable = useGameStore((s) => s.playable)
  useLobbyColliders()
  useLobbyDisplays()

  const geo = useMemo(() => {
    const w = ISLAND.maxX - ISLAND.minX
    const d = ISLAND.maxZ - ISLAND.minZ
    const island = createWorldBoxGeometry(w, 6, d, 3)
    island.translate((ISLAND.minX + ISLAND.maxX) / 2, -3, (ISLAND.minZ + ISLAND.maxZ) / 2)
    return {
      island,
      // Thin decals on the ground (not slabs), so feet stay on top of them.
      // The path has a hole under the checkered spawn pad: a floor face just beneath
      // the pad's top would flicker through it at a distance.
      paths: mergedBoxes(PATHS.slice(1).map((r) => slab(r, PATH_TOP))),
      // The spawn plaza in its own lighter stone, so the lobby isn't one sea of yellow.
      plaza: mergedBoxes(aroundSpawnPad(PATHS[0]).map((r) => slab(r, PATH_TOP))),
      borders: mergedBoxes(PATHS.map((r) => slab(r, 0.015, 0.1, 0.7))),
      carpet: mergedBoxes([slab(CARPET, 0.02)]),
    }
  }, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g?.dispose()), [geo])

  const islandMaterials = useMemo(() => {
    const side = studMaterial(T.edge)
    // Under every path and apron: pushed furthest back (see decalMaterial).
    const top = decalMaterial(T.ground, 3)
    return [side, side, top, side, side, side]
  }, [])

  const arenas = useMemo(
    () =>
      RING_LIST.map((ring) => ({
        ...RING_POSITIONS[ring.id],
        radius: LOBBY.ringRadius,
        floor: PALETTE.white,
        wall: ring.color,
        trim: RINGS[ring.id].rebirths >= 6 ? '#ffffff' : PALETTE.gold,
      })),
    [],
  )

  const decor = useMemo(() => {
    const blocks = []
    const L = PALETTE.leaves
    TREES.forEach(([x, z], i) => blocks.push(...treeBlocks(x, z, 1.05, [L[i % 3], L[(i + 1) % 3], L[(i + 2) % 3]])))
    blocks.push(...MOUNTAINS.trees)
    // A coloured plate under each training ring, like the original, and the square
    // training pad in front of it: stand on the pad to train at that ring.
    for (const ring of RING_LIST) {
      const p = RING_POSITIONS[ring.id]
      const plate = LOBBY.ringRadius * 2 + 1.6
      blocks.push({ matrix: boxBlock(p.x, 0.03, p.z, plate, 0.08, plate), color: ring.color })
      const pad = trainPad(ring.id)
      const s = TRAIN_PAD.size
      // A stepped plinth: white outer rim, navy step, then the coloured pad (each a
      // different height, so no two faces share a plane).
      blocks.push({ matrix: boxBlock(pad.x, 0.05, pad.z, s + 0.8, 0.1, s + 0.8), color: PALETTE.white })
      blocks.push({ matrix: boxBlock(pad.x, 0.08, pad.z, s + 0.4, 0.16, s + 0.4), color: PALETTE.navy })
      blocks.push({ matrix: boxBlock(pad.x, TRAIN_PAD.top / 2, pad.z, s, TRAIN_PAD.top, s), color: ring.color })
      for (const dx of [-1, 1]) {
        for (const dz of [-1, 1]) {
          blocks.push({ matrix: boxBlock(pad.x + dx * (s / 2 - 0.3), TRAIN_PAD.top + 0.08, pad.z + dz * (s / 2 - 0.3), 0.36, 0.16, 0.36), color: PALETTE.gold })
        }
      }
    }
    // Checkered spawn pad.
    for (let i = 0; i < 4; i += 1) {
      for (let j = 0; j < 4; j += 1) {
        blocks.push({ matrix: boxBlock(-2.25 + i * 1.5, 0.05, -2.25 + j * 1.5, 1.5, 0.06, 1.5), color: (i + j) % 2 ? PALETTE.blue : PALETTE.white })
      }
    }
    // TRAIN POWER arch, built like the slide game's start arch: striped pillars with
    // gold caps, a navy board in a blue frame, and lights along its edges.
    for (const x of [-ARCH.x, ARCH.x]) blocks.push(...stripedPillar(x, ARCH_Z, ARCH.top, 'z').blocks)
    blocks.push({ matrix: boxBlock(0, ARCH.beamY, ARCH_Z, ARCH.x * 2 + 0.6, 4.4, 0.7), color: PALETTE.blue })
    blocks.push({ matrix: boxBlock(0, ARCH.beamY, ARCH_Z, ARCH.x * 2 - 1.4, 3.6, 0.9), color: PALETTE.navy })
    blocks.push({ matrix: boxBlock(0, ARCH.beamY - 2.35, ARCH_Z, ARCH.x * 2 - 1.8, 0.26, 0.95), color: PALETTE.sky })
    // Gold top between the pillars (over them, it sat 5 cm above their tops and flickered).
    blocks.push({ matrix: boxBlock(0, ARCH.beamY + 2.3, ARCH_Z, ARCH.x * 2 - 1.6, 0.3, 0.9), color: PALETTE.gold })
    for (let x = -ARCH.x + 1.5, i = 0; x <= ARCH.x - 1.5; x += 1, i += 1) {
      for (const side of [-1, 1]) {
        const fz = ARCH_Z + side * 0.4
        blocks.push({ matrix: boxBlock(x, ARCH.beamY + 2.02, fz, 0.3, 0.3, 0.16), color: i % 2 ? PALETTE.gold : PALETTE.white })
        blocks.push({ matrix: boxBlock(x + 0.5, ARCH.beamY - 2.0, fz, 0.3, 0.3, 0.16), color: i % 2 ? PALETTE.white : PALETTE.gold })
      }
    }
    // WINS SHOP board on the same striped pillars, facing the spawn.
    for (const z of [-11, 11]) blocks.push(...stripedPillar(SHOP_BOARD_X, z, 12, 'x').blocks)
    blocks.push({ matrix: boxBlock(SHOP_BOARD_X, 9.2, 0, 0.8, 6.2, 20.2), color: PALETTE.gold })
    // White rim round the shop's light-blue apron.
    const cx = (CARPET.minX + CARPET.maxX) / 2
    const cz = (CARPET.minZ + CARPET.maxZ) / 2
    const cw = CARPET.maxX - CARPET.minX
    const cd = CARPET.maxZ - CARPET.minZ
    // It stops where a path crosses it: a rim lying on the path flickered against it.
    for (const z of [CARPET.minZ, CARPET.maxZ]) {
      for (const [a, b] of rimSegments(cx - cw / 2 - 0.5, cx + cw / 2 + 0.5, z, true)) {
        blocks.push({ matrix: boxBlock((a + b) / 2, 0.04, z, b - a, 0.06, 0.5), color: PALETTE.apronEdge })
      }
    }
    for (const x of [CARPET.minX, CARPET.maxX]) {
      for (const [a, b] of rimSegments(cz - cd / 2, cz + cd / 2, x, false)) {
        blocks.push({ matrix: boxBlock(x, 0.04, (a + b) / 2, 0.5, 0.06, b - a), color: PALETTE.apronEdge })
      }
    }
    // Leaderboard frames.
    for (const b of LEADERBOARD_POSITIONS) {
      blocks.push({ matrix: boxBlock(b.x + 0.05, 5.2, b.z, 0.5, 10, 8.2), color: PALETTE.navy })
      blocks.push({ matrix: boxBlock(b.x, 0.3, b.z, 1.4, 0.6, 9), color: PALETTE.blue })
    }
    return blocks
  }, [])

  const signs = useMemo(() => mainSigns(), [])
  const labels = useMemo(() => labelSigns(), [])
  const doors = useMemo(() => [WORLDS_DOOR], [])

  return (
    <group>
      <mesh geometry={geo.island} material={islandMaterials} receiveShadow />
      {/* Ground layers, pushed back by polygon offset so none of them flicker; the
          paths on top keep their true depth so nothing standing on them is cut off. */}
      <mesh geometry={geo.borders} material={decalMaterial(T.pathEdge, 2)} receiveShadow />
      <mesh geometry={geo.carpet} material={decalMaterial(PALETTE.apron, 1)} receiveShadow />
      <mesh geometry={geo.paths} material={studMaterial(T.path)} receiveShadow />
      <mesh geometry={geo.plaza} material={studMaterial(PALETTE.plazaStone)} receiveShadow />

      <StageLine worldId="grassland" decor={DECOR.grass} />
      <Arenas arenas={arenas} />
      <PadFaces pads={TRAIN_PAD_FACES} />
      <CapsuleMachines pads={PADS} />
      <Doors doors={doors} />
      <DecorBlocks blocks={decor} castShadow />
      <Mountains />
      {/* Drawn just after the first frame, under the fading loading screen; mounted
          empty before that so the sign shader is still compiled in the warm-up. */}
      <Signs signs={playable ? signs : NO_SIGNS} />
      {settled && <Signs signs={labels} />}
      {settled && <Leaderboards />}
    </group>
  )
}
