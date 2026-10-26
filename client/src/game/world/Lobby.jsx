import { useEffect, useMemo } from 'react'

import {
  CAPSULES,
  CAPSULE_POSITIONS,
  CRYSTAL_OFFER,
  CRYSTAL_POSITION,
  DOOR,
  LEADERBOARD_POSITIONS,
  LOBBY,
  PUMPKINS,
  RARITIES,
  RINGS,
  RING_LIST,
  RING_POSITIONS,
  SPINNERS,
  WORLDS_PORTAL,
  formatNumber,
  gateZ,
} from '@shared'

import { useGameStore } from '../../store/gameStore'
import { clearColliders, setColliders } from '../collision'
import { ORDER, useSystem } from '../loop'
import { SPRITE, fxBatch, shadowBatch } from '../render/fxBatch'
import { studMaterial } from '../render/materials'
import { THEMES } from '../sceneStyle'
import { FAMILIES } from '../spinners/spinnerGeometry'
import { customPalette, spinnerBatch, spinnerPalette } from '../spinners/spinnerBatch'
import { createWorldBoxGeometry } from '../textures'
import { DECOR } from './decor'
import { boxMatrix as boxBlock, mergedBoxes } from './parts/builders'
import { crateBlocks, flowerBlocks, logBlocks, treeBlocks } from './parts/decorBlocks'
import { doorPillarCircles, doorScreenSign } from './parts/doorParts'
import { Doors } from './parts/Doors'
import { Arenas } from './parts/Instanced'
import { Leaderboards } from './parts/Leaderboards'
import { CapsuleMachines } from './parts/Machines'
import { DecorBlocks, Graves, Pumpkins } from './parts/Props'
import { Signs } from './parts/Signs'
import { bannerText, boardSign, labelPanel } from './parts/signStyles'
import { ringFx } from './ringFx'
import StageLine from './StageLine'

/**
 * The hub, laid out around the spawn point like the original:
 *
 *   in front  - the Stage 1 gate, with every Grassland stage lined up behind it
 *   behind    - TRAIN POWER: the training rings in pairs along the path
 *   left      - the WINS SHOP: capsule machines on a carpet, the Crystal Spinner
 *   right     - the leaderboards, and a Halloween corner behind them
 *   front-left - the Worlds portal (Lava, Galaxy, Halloween)
 */

const T = THEMES.lobby
const ISLAND = LOBBY.island
const CAPSULE_IDS = ['basic', 'common', 'rare', 'epic', 'exclusive', 'legendary', 'mythic', 'celestial', 'godly', 'halloween']

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
  { minX: -14, maxX: 14, minZ: -12, maxZ: 12 }, // spawn plaza
  { minX: -7, maxX: 7, minZ: -36, maxZ: -12 }, // forward to the Stage 1 gate
  { minX: -6, maxX: 6, minZ: 12, maxZ: 114 }, // back through the training rings
  { minX: -78, maxX: -14, minZ: -4, maxZ: 4 }, // left into the Wins Shop
  { minX: 14, maxX: 44, minZ: -4, maxZ: 4 }, // right to the leaderboards
  { minX: -36, maxX: -7, minZ: -24, maxZ: -16 }, // to the Worlds portal
  { minX: 26, maxX: 34, minZ: 4, maxZ: 36 }, // to the Halloween corner
]
const CARPET = { minX: -76, maxX: -24, minZ: -15, maxZ: 15 }
const SPOOKY = { minX: 24, maxX: 72, minZ: 28, maxZ: 74 }

const TREES = [
  [-48, -30], [-62, -30], [-74, -28], [-40, 46], [-58, 40], [-74, 54], [-42, 76], [-62, 88], [-44, 108], [-72, 112],
  [42, -30], [72, -30], [66, -8], [70, 14], [44, 86], [64, 98], [42, 108], [72, 112], [70, 82],
]
const SPOOKY_TREES = [[58, 38], [66, 62], [30, 68]]
const GRAVES = [
  { x: 46, z: 46, ry: 0.2 }, { x: 52, z: 52, ry: -0.3 }, { x: 44, z: 58, ry: 0.4 }, { x: 58, z: 66, ry: -0.1 },
  { x: 36, z: 60, ry: 0.5 }, { x: 50, z: 68, ry: -0.6 }, { x: 64, z: 48, ry: 0.1 },
]
const ARCH_Z = 17
const SHOP_BOARD_X = -78.4
const WORLDS_DOOR = { ...WORLDS_PORTAL, id: 'worlds', kind: 'portal', color: '#2cf3ff', screen: DOOR.screen }

/** Banners and door displays: drawn before the first frame. */
function mainSigns() {
  return [
    { x: 0, y: 8.2, z: ARCH_Z - 0.5, ry: Math.PI, w: 15, h: 3, draw: bannerText('TRAIN POWER') },
    {
      x: SHOP_BOARD_X + 0.5,
      y: 9.2,
      z: 0,
      ry: Math.PI / 2,
      w: 26,
      h: 5.4,
      draw: boardSign(
        [
          { text: 'WINS SHOP', size: 0.62, fill: ['#fff36b', '#ffb300'], stroke: '#5a1200' },
          { text: 'Spend wins on capsules!', size: 0.24 },
        ],
        { bg: '#e8243a', border: '#ffd400' },
      ),
    },
    { x: 0, y: 17, z: gateZ(1) + 1, ry: 0, w: 18, h: 3.2, draw: bannerText('BATTLE STAGES', ['#fff36b', '#ffb300'], '#3a1e00') },
    { x: 0, y: 13.5, z: 117, ry: Math.PI, w: 24, h: 4.2, draw: bannerText('+1 SPINNER EVOLUTION', ['#7df9ff', '#2f7bff'], '#0b1240') },
    doorScreenSign(
      WORLDS_DOOR,
      boardSign(
        [
          { text: 'WORLDS', size: 0.5, fill: ['#ffffff', '#7df9ff'] },
          { text: 'Lava • Galaxy • Halloween', size: 0.24, fill: '#bfe9ff' },
        ],
        { bg: '#1f3fa6', border: '#2cf3ff' },
      ),
    ),
  ]
}

/** The small floating labels (rings, capsules): drawn just after the game starts. */
function labelSigns() {
  const signs = []
  for (const ring of RING_LIST) {
    const p = RING_POSITIONS[ring.id]
    const title = ring.rebirths ? `REBIRTH ${ring.rebirths}` : ring.name.toUpperCase()
    signs.push({ x: p.x, y: 6.4, z: p.z, w: 7.5, h: 2.6, billboard: true, draw: labelPanel(title, `x${ring.mult} POWER`, { titleFill: ['#fff36b', '#ffb300'], subFill: '#ffffff', panel: 'rgba(16,20,40,0.35)' }) })
  }
  for (const id of CAPSULE_IDS) {
    const c = CAPSULES[id]
    const p = CAPSULE_POSITIONS[id]
    const price = `${formatNumber(c.cost)} ${c.currency === 'candy' ? 'Candy' : 'Wins'}`
    const sub = c.rebirths ? `${price} • Rebirth ${c.rebirths}` : price
    const best = RARITIES[SPINNERS[c.drops[c.drops.length - 1].spinner].rarity]
    signs.push({ x: p.x, y: 5.4, z: p.z, w: 6.4, h: 2.2, billboard: true, draw: labelPanel(c.name, sub, { titleFill: [best.color, '#ffffff'], panel: 'rgba(16,20,40,0.4)' }) })
  }
  signs.push({ x: CRYSTAL_POSITION.x, y: 7.6, z: CRYSTAL_POSITION.z, w: 7, h: 2.4, billboard: true, draw: labelPanel('Crystal Spinner', `${formatNumber(CRYSTAL_OFFER.cost)} Wins • Rebirth ${CRYSTAL_OFFER.rebirths}`, { titleFill: ['#e0b3ff', '#7df9ff'] }) })
  return signs
}

function useLobbyColliders() {
  useEffect(() => {
    const circles = []
    for (const ring of RING_LIST) {
      const p = RING_POSITIONS[ring.id]
      circles.push({ x: p.x, z: p.z, r: LOBBY.ringRadius + 1.3, minY: -2, maxY: 1.6 })
    }
    for (const id of CAPSULE_IDS) {
      const p = CAPSULE_POSITIONS[id]
      circles.push({ x: p.x, z: p.z, r: 2.9, minY: -1, maxY: 4 })
    }
    circles.push({ x: CRYSTAL_POSITION.x, z: CRYSTAL_POSITION.z, r: 2.3, minY: -1, maxY: 1 })
    for (const [x, z] of TREES) circles.push({ x, z, r: 0.75, minY: -1, maxY: 4 })
    for (const [x, z] of SPOOKY_TREES) circles.push({ x, z, r: 0.7, minY: -1, maxY: 4 })
    for (const g of GRAVES) circles.push({ x: g.x, z: g.z, r: 0.7, minY: -1, maxY: 2 })
    circles.push(...doorPillarCircles(WORLDS_DOOR))
    const box = (x, z, w, d, maxY = 12) => ({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY: -1, maxY })
    const boxes = [
      box(-8.5, ARCH_Z, 1.6, 1.6),
      box(8.5, ARCH_Z, 1.6, 1.6),
      box(SHOP_BOARD_X, -11, 1.6, 1.6),
      box(SHOP_BOARD_X, 11, 1.6, 1.6),
      ...LEADERBOARD_POSITIONS.map((b) => box(b.x, b.z, 1.4, 9)),
    ]
    setColliders('lobby', {
      floors: [{ minX: ISLAND.minX, maxX: ISLAND.maxX, minZ: ISLAND.minZ, maxZ: ISLAND.maxZ, top: 0 }],
      boxes,
      circles,
    })
    return () => clearColliders('lobby')
  }, [])
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
      spinnerBatch.push(FAMILIES[i % FAMILIES.length], p.x + sx, 0.15, p.z, t * 1.5 + i, 0.05, t, 1.25, pal, ring.rebirths >= 6 ? 0.4 : 0, rf.flash, false)
      shadowBatch.push(p.x, 0.17, p.z, 2.8, 0, 0, 0.05, 0.4, SPRITE.glow, true)
    }

    const c = CRYSTAL_POSITION
    const bob = Math.sin(t * 1.6) * 0.25
    const pal = spinnerPalette('crystal')
    spinnerBatch.push(SPINNERS.crystal.family, c.x, 2.5 + bob, c.z, t * 2.2, 0.35, t * 0.7, 1.7, pal, 1, 0, false)
    fxBatch.push(c.x, 3.2 + bob, c.z, 7, pal.a.r, pal.a.g, pal.a.b, 0.55, SPRITE.glow)
    fxBatch.push(c.x, 3 + bob, c.z, 5.5, pal.b.r, pal.b.g, pal.b.b, 0.7, SPRITE.ring, false, t)
    shadowBatch.push(c.x, 1.02, c.z, 3, 0, 0, 0.05, 0.3, SPRITE.glow, true)
  })
}

export default function Lobby() {
  // Leaderboards and small labels are the slowest signs to draw; they can wait until
  // the player is in.
  const settled = useGameStore((s) => s.settled)
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
      paths: mergedBoxes(PATHS.map((r) => slab(r, 0.025))),
      borders: mergedBoxes(PATHS.map((r) => slab(r, 0.015, 0.1, 0.7))),
      carpet: mergedBoxes([slab(CARPET, 0.02)]),
      spooky: mergedBoxes([slab(SPOOKY, 0.01, 0.06)]),
      pedestal: mergedBoxes([{ x: CRYSTAL_POSITION.x, y: 0.5, z: CRYSTAL_POSITION.z, w: 4, h: 1, d: 4 }]),
    }
  }, [])
  useEffect(() => () => Object.values(geo).forEach((g) => g?.dispose()), [geo])

  const islandMaterials = useMemo(() => {
    const side = studMaterial(T.edge)
    const top = studMaterial(T.ground)
    return [side, side, top, side, side, side]
  }, [])

  const arenas = useMemo(
    () =>
      RING_LIST.map((ring) => ({
        ...RING_POSITIONS[ring.id],
        radius: LOBBY.ringRadius,
        floor: '#aab4dd',
        wall: ring.color,
        trim: RINGS[ring.id].rebirths >= 6 ? '#ffffff' : '#ffd23a',
      })),
    [],
  )

  const decor = useMemo(() => {
    const blocks = []
    for (const [x, z] of TREES) blocks.push(...treeBlocks(x, z, 1.05))
    for (const [x, z] of SPOOKY_TREES) blocks.push(...treeBlocks(x, z, 0.9, '#5b2a86', '#2b1a12'))
    // A coloured plate under each training ring, like the original.
    for (const ring of RING_LIST) {
      const p = RING_POSITIONS[ring.id]
      blocks.push({ matrix: boxBlock(p.x, 0.03, p.z, 19, 0.08, 19), color: ring.color })
    }
    // Checkered spawn pad.
    for (let i = 0; i < 4; i += 1) {
      for (let j = 0; j < 4; j += 1) {
        blocks.push({ matrix: boxBlock(-2.25 + i * 1.5, 0, -2.25 + j * 1.5, 1.5, 0.06, 1.5), color: (i + j) % 2 ? '#2f7bff' : '#f4f6ff' })
      }
    }
    // TRAIN POWER arch.
    blocks.push(...[-8.5, 8.5].map((x) => ({ matrix: boxBlock(x, 4.5, ARCH_Z, 1.6, 9, 1.6), color: '#5f6fb0' })))
    blocks.push({ matrix: boxBlock(0, 8.2, ARCH_Z + 0.1, 17.6, 3.6, 0.8), color: '#ffd23a' })
    // WINS SHOP board on pillars, facing the spawn.
    blocks.push(...[-11, 11].map((z) => ({ matrix: boxBlock(SHOP_BOARD_X, 6, z, 1.6, 12, 1.6), color: '#5f6fb0' })))
    blocks.push({ matrix: boxBlock(SHOP_BOARD_X, 9.2, 0, 0.8, 6.2, 27.2), color: '#ffd400' })
    // Leaderboard frames.
    for (const b of LEADERBOARD_POSITIONS) {
      blocks.push({ matrix: boxBlock(b.x + 0.05, 5.2, b.z, 0.5, 10, 8.2), color: '#2a3270' })
      blocks.push({ matrix: boxBlock(b.x, 0.3, b.z, 1.4, 0.6, 9), color: '#5f6fb0' })
    }
    // Little things: flowers, crates, logs.
    const flowers = [[-12, 14], [-14, 18], [12, 16], [14, 20], [-26, 62], [26, 88], [-9, 40], [9, 72], [-30, -20], [36, -16], [56, 30], [-74, 24]]
    flowers.forEach(([x, z], i) => blocks.push(...flowerBlocks(x, z, ['#ff4d6d', '#4dc3ff', '#ffffff', '#ffd23a'][i % 4])))
    for (const [x, z, s] of [[20, -24, 1.4], [21.5, -22.8, 1], [36, 70, 1.2], [-50, 60, 1.6], [16, -30, 1.2], [-8, 116, 1.3]]) blocks.push(...crateBlocks(x, z, s))
    blocks.push(...logBlocks(30, -30, 0.6), ...logBlocks(34, 96, -0.4), ...logBlocks(-56, 100, 1.2))
    // Spooky lamp posts.
    for (const [x, z] of [[28, 40], [54, 58], [40, 70]]) {
      blocks.push({ matrix: boxBlock(x, 2, z, 0.35, 4, 0.35), color: '#1d1d2a' })
      blocks.push({ matrix: boxBlock(x, 4.2, z, 0.9, 0.7, 0.9), color: '#ffb300' })
    }
    return blocks
  }, [])

  const signs = useMemo(() => mainSigns(), [])
  const labels = useMemo(() => labelSigns(), [])
  const doors = useMemo(() => [WORLDS_DOOR], [])
  const decorPumpkins = useMemo(() => [{ x: 34, z: 48, s: 1.3 }, { x: 30, z: 54, s: 0.8 }, { x: 46, z: 40, s: 1 }, { x: 40, z: 52, s: 1.1 }], [])

  return (
    <group>
      <mesh geometry={geo.island} material={islandMaterials} receiveShadow />
      <mesh geometry={geo.borders} material={studMaterial('#3c4a96')} receiveShadow />
      <mesh geometry={geo.paths} material={studMaterial(T.path)} receiveShadow />
      <mesh geometry={geo.carpet} material={studMaterial('#ff5a7a')} receiveShadow />
      <mesh geometry={geo.spooky} material={studMaterial('#3d2a5e')} receiveShadow />
      <mesh geometry={geo.pedestal} material={studMaterial('#ffd23a')} receiveShadow />

      <StageLine worldId="grassland" decor={DECOR.grass} />
      <Arenas arenas={arenas} />
      <CapsuleMachines ids={CAPSULE_IDS} />
      <Doors doors={doors} />
      <DecorBlocks blocks={decor} castShadow />
      <Pumpkins items={PUMPKINS} collectible />
      <Pumpkins items={decorPumpkins} />
      <Graves items={GRAVES} />
      <Signs signs={signs} />
      {settled && <Signs signs={labels} />}
      {settled && <Leaderboards />}
    </group>
  )
}
