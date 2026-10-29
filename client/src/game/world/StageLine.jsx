import { useEffect, useMemo, useRef } from 'react'

import {
  DOOR,
  STAGE,
  WORLDS,
  arenaZ,
  enemyPad,
  gateOpen,
  formatNumber,
  gateZ,
  lineEndZ,
  playerPad,
  returnPad,
  stageArmy,
  stageDoor,
  stageWins,
} from '@shared'

import { useGameStore } from '../../store/gameStore'
import { live } from '../../store/live'
import { quality } from '../../store/qualityStore'
import { clearColliders, setColliders } from '../collision'
import { ORDER, useSystem } from '../loop'
import { decalMaterial, studMaterial } from '../render/materials'
import { PALETTE, THEMES } from '../sceneStyle'
import { createWorldBoxGeometry } from '../textures'
import { boxMatrix, mergedBoxes } from './parts/builders'
import { doorPillarCircles, doorScreenSign } from './parts/doorParts'
import { Doors } from './parts/Doors'
import { GateBoards } from './parts/GateBoards'
import { PadFaces } from './parts/PadFaces'
import { Arenas } from './parts/Instanced'
import { DecorBlocks } from './parts/Props'
import { Champions } from './parts/Champions'
import { ReturnPads } from './parts/ReturnPads'
import { Signs } from './parts/Signs'
import { bannerText, gateBoard, labelPanel } from './parts/signStyles'
import { StageFx } from './parts/StageFx'
import { BLEACHER, TORCH, WALL_HEIGHT, bleacherBlocks, gateDressing, wallDressing } from './parts/stageProps'

/**
 * One world's stages in a single straight line, running away from the spawn (-Z):
 *
 *   [gate 1] blue pad - ARENA 1 - red pad  [Return pad]  [gate 2] blue pad - ARENA 2 ...
 *
 * Gates open in order as stages are beaten; inside, stand on the blue pad to fight. Winning opens
 * that gate; the next one waits past the arena, with a Return pad in front of it to
 * cash out. The lobby builds Grassland's line in front of its spawn; the other worlds
 * build theirs the same way.
 */

const HALF = STAGE.islandHalfWidth
/** Outer half-width of a stage gate, frame included: the castle wall starts there. */
const GATE_HALF = STAGE.gateWidth / 2 + DOOR.pillar
/** The "KILL THE ENEMIES TO ENTER" board hung inside each gate. */
const BOARD = { y: 8.4, w: 11.5, h: 6.6 }
/** How far past the view distance a stage still draws (the camera sits behind you). */
const STAGE_CULL_MARGIN = 18
const NO_BOARDS = []

/** How far stage i (0-based) is from a player at z along the line; 0 inside it. */
function stageDistance(i, pz) {
  const front = gateZ(i + 1) + 2
  const back = gateZ(i + 2)
  return pz > front ? pz - front : pz < back ? back - pz : 0
}
/** Gates whose boards are drawn before the first frame (the one in front of spawn). */
const NEAR_GATES = 1

/** Base reward a Return pad pays after clearing `k` stages (multipliers excluded). */
function returnLabel(worldId, k) {
  const w = WORLDS[worldId]
  let wins = 0
  for (let i = 1; i <= k; i += 1) wins += stageWins(worldId, w.firstStage + i - 1)
  return `+${formatNumber(wins)} Win${wins === 1 ? '' : 's'}`
}

const PAD_TOP = STAGE.padTop

/** A square pad with a yellow rim (blue = you, red = the enemy). */
function padBlocks(p, color) {
  const s = STAGE.padSize
  return [
    { matrix: boxMatrix(p.x, 0.15, p.z, s + 0.6, 0.3, s + 0.6), color: PALETTE.gold },
    { matrix: boxMatrix(p.x, 0.32, p.z, s, 0.34, s), color },
  ]
}

/** Each stage's gate: glass that opens once this run has beaten that stage. */
function stageDoors(worldId, n, theme) {
  const colors = { base: theme.arenaWall, band: theme.band, body: theme.wall, cap: theme.trim, light: theme.light }
  return Array.from({ length: n }, (_, i) => {
    const k = i + 1
    return {
      ...stageDoor(k),
      id: `gate-${k}`,
      kind: 'gate',
      board: BOARD,
      colors,
      open: () => gateOpen(k, live.run && live.run.world === worldId ? live.run.cleared : 0),
    }
  })
}

function useLineColliders(worldId, n, doors) {
  useEffect(() => {
    const circles = []
    const boxes = []
    const floors = []
    const end = lineEndZ(n)
    const start = gateZ(1)
    // Edge walls the whole way, so nobody walks round a gate from the lobby.
    boxes.push({ minX: -HALF - 1, maxX: -HALF + 0.8, minZ: end, maxZ: start + 1, minY: -1, maxY: 3 })
    boxes.push({ minX: HALF - 0.8, maxX: HALF + 1, minZ: end, maxZ: start + 1, minY: -1, maxY: 3 })
    for (const door of doors) circles.push(...doorPillarCircles(door))
    for (let k = 1; k <= n; k += 1) {
      circles.push({ x: 0, z: arenaZ(k), r: STAGE.wallRadius + 0.1, minY: -2, maxY: 1.8 })
      const ep = enemyPad(k)
      circles.push({ x: ep.x, z: ep.z, r: 1, minY: -1, maxY: 3.5 })
      const az = arenaZ(k)
      boxes.push({ minX: BLEACHER.front, maxX: BLEACHER.back + 0.6, minZ: az + BLEACHER.minZ, maxZ: az + BLEACHER.maxZ, minY: -1, maxY: 4.4 })
      for (const side of [-1, 1]) circles.push({ x: side * TORCH.x, z: gateZ(k) + TORCH.dz, r: 0.55, minY: -1, maxY: 3.6 })
      // The pads are low steps you stand on.
      const half = STAGE.padSize / 2 + 0.3
      for (const p of [playerPad(k), ep]) {
        floors.push({ minX: p.x - half, maxX: p.x + half, minZ: p.z - half, maxZ: p.z + half, top: PAD_TOP })
      }
      const rp = returnPad(k)
      const rh = STAGE.returnPadRadius * 0.8
      floors.push({ minX: rp.x - rh, maxX: rp.x + rh, minZ: rp.z - rh, maxZ: rp.z + rh, top: STAGE.returnPadTop })
      const gz = gateZ(k)
      // Castle walls either side of the gate.
      boxes.push({ minX: -HALF, maxX: -GATE_HALF + 0.4, minZ: gz - 1.45, maxZ: gz + 1.45, minY: -1, maxY: WALL_HEIGHT + 1 })
      boxes.push({ minX: GATE_HALF - 0.4, maxX: HALF, minZ: gz - 1.45, maxZ: gz + 1.45, minY: -1, maxY: WALL_HEIGHT + 1 })
      // The glass itself, until this run has beaten stage k.
      const door = doors[k - 1]
      boxes.push({
        minX: -STAGE.gateWidth / 2,
        maxX: STAGE.gateWidth / 2,
        minZ: gz - 0.6,
        maxZ: gz + 0.6,
        minY: -1,
        maxY: STAGE.gateHeight,
        enabled: () => !door.open(),
      })
    }
    // The trophy at the very end.
    circles.push({ x: 0, z: gateZ(n + 1) + 2, r: 1.8, minY: -1, maxY: 5 })
    setColliders(`line:${worldId}`, {
      // Feet rest on the paths' surface (thin decals 2.5 cm up).
      floors: [{ minX: -HALF, maxX: HALF, minZ: end, maxZ: start + 2, top: 0.025 }, ...floors],
      boxes,
      circles,
    })
    return () => clearColliders(`line:${worldId}`)
  }, [worldId, n, doors])
}

/**
 * @param {{ worldId: string, decor?: (k: number, z: number) => Array }} props
 *   decor(k, z) adds box blocks around arena k (centred at z).
 */
export default function StageLine({ worldId, decor }) {
  const world = WORLDS[worldId]
  const theme = THEMES[world.theme === 'grass' ? 'grassland' : world.theme]
  const n = world.stageCount
  const doors = useMemo(() => stageDoors(worldId, n, theme), [worldId, n, theme])

  useLineColliders(worldId, n, doors)

  const geo = useMemo(() => {
    const start = gateZ(1) + 2
    const end = lineEndZ(n)
    const length = start - end
    const island = createWorldBoxGeometry(HALF * 2, 5, length, 3)
    island.translate(0, -2.5, start - length / 2)
    const paths = []
    const walls = []
    for (let k = 1; k <= n; k += 1) {
      const gz = gateZ(k)
      // Grey platform in front of the next gate, holding the Return pad.
      paths.push({ x: 0, y: -0.035, z: gz - 49, w: 36, h: 0.12, d: 14 })
      // Lane from the blue pad round the arena to that platform. It starts after the
      // checkered strip, which lies on the ground: a floor face just beneath the strip's
      // top would flicker through it at a distance.
      paths.push({ x: 0, y: -0.035, z: gz - 6.175, w: STAGE.gateWidth, h: 0.12, d: 4.65 })
      walls.push({ x: -(HALF + GATE_HALF) / 2, y: WALL_HEIGHT / 2, z: gz, w: HALF - GATE_HALF, h: WALL_HEIGHT, d: 1.6 })
      walls.push({ x: (HALF + GATE_HALF) / 2, y: WALL_HEIGHT / 2, z: gz, w: HALF - GATE_HALF, h: WALL_HEIGHT, d: 1.6 })
    }
    return { island, paths: mergedBoxes(paths), walls: mergedBoxes(walls) }
  }, [n])
  useEffect(() => () => Object.values(geo).forEach((g) => g?.dispose()), [geo])

  const islandMaterials = useMemo(() => {
    const side = studMaterial(theme.edge)
    // Under the paths: pushed back by polygon offset (see decalMaterial), as far as the
    // lobby's ground, so the lobby path's border wins where the two meet at gate 1.
    const top = decalMaterial(theme.ground, 3)
    return [side, side, top, side, side, side]
  }, [theme])

  const arenas = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => ({
        x: 0,
        z: arenaZ(i + 1),
        radius: STAGE.arenaRadius,
        floor: theme.arena,
        wall: theme.arenaWall,
        trim: theme.trim,
      })),
    [n, theme],
  )

  // One instanced set per stage, so stages off screen or past the far plane are culled.
  const stageBlocks = useMemo(() => {
    const sets = []
    for (let k = 1; k <= n; k += 1) {
      const out = []
      sets.push(out)
      const gz = gateZ(k)
      out.push(...padBlocks(playerPad(k), '#2f9bff'), ...padBlocks(enemyPad(k), '#e8243a'))
      out.push(...bleacherBlocks(k, arenaZ(k), theme), ...gateDressing(gz, theme), ...wallDressing(gz, theme))
      // Checkered start strip just past each gate.
      for (let row = 0; row < 2; row += 1) {
        for (let col = 0; col < 12; col += 1) {
          const white = (row + col) % 2 === 0
          out.push({
            matrix: boxMatrix(-8.25 + col * 1.5, 0.05, gz - 1.6 - row * 1.5, 1.5, 0.06, 1.5),
            color: white ? '#f4f6ff' : theme.path,
          })
        }
      }
      // Battlements along both island edges.
      for (let i = 0; i < 9; i += 1) {
        const z = gz - 3 - i * 6
        for (const x of [-HALF + 0.8, HALF - 0.8]) {
          out.push({ matrix: boxMatrix(x, 1, z, 1.6, 2, 1.6), color: theme.wall })
          out.push({ matrix: boxMatrix(x, 2.3, z, 1.7, 0.6, 1.7), color: i % 2 ? theme.trim : PALETTE.gold })
        }
      }
      if (decor) out.push(...decor(k, arenaZ(k)))
    }
    // Trophy statue at the end of the line, with the last stage.
    const fz = gateZ(n + 1) + 2
    const last = sets[n - 1]
    last.push({ matrix: boxMatrix(0, 0.6, fz, 3.4, 1.2, 3.4), color: theme.wall })
    last.push({ matrix: boxMatrix(0, 2.2, fz, 1.4, 2, 1.4), color: PALETTE.gold })
    last.push({ matrix: boxMatrix(0, 3.8, fz, 3, 1.4, 3), color: PALETTE.gold })
    return sets
  }, [n, theme, decor])

  const pads = useMemo(() => Array.from({ length: n }, (_, i) => ({ k: i + 1, ...returnPad(i + 1) })), [n])
  const padFaces = useMemo(() => {
    const out = []
    for (let k = 1; k <= n; k += 1) {
      out.push({ ...playerPad(k), top: PAD_TOP, size: STAGE.padSize, color: '#2f9bff' })
      out.push({ ...enemyPad(k), top: PAD_TOP, size: STAGE.padSize, color: '#e8243a' })
    }
    return out
  }, [n])

  // Stages past the fog aren't drawn at all (the fog hides them completely anyway).
  const stageGroups = useRef([])
  useSystem(ORDER.world, () => {
    const pz = live.player.z
    const reach = quality().viewDistance + STAGE_CULL_MARGIN
    for (let i = 0; i < stageGroups.current.length; i += 1) {
      const g = stageGroups.current[i]
      if (g) g.visible = stageDistance(i, pz) < reach
    }
  })

  // The first gates' boards are drawn before the first frame; the rest of the line's
  // signs (further gates, Return labels) right after the game opens. Likewise only the
  // stages in view get their decor before the first frame on the first load.
  const settled = useGameStore((s) => s.settled)
  const playable = useGameStore((s) => s.playable)
  const inViewAtMount = useMemo(() => {
    const reach = quality().viewDistance + STAGE_CULL_MARGIN
    return stageBlocks.map((_, i) => stageDistance(i, live.player.z) < reach)
  }, [stageBlocks])
  const { nearBoards, farBoards, farSigns } = useMemo(() => {
    const list = []
    const near = []
    const far = []
    for (let k = 1; k <= n; k += 1) {
      const global = world.firstStage + k - 1
      const army = stageArmy(worldId, global)
      const door = doors[k - 1]
      const sign = doorScreenSign(
        door,
        gateBoard({
          note: k === 1 ? 'STAND ON THE BLUE PAD TO BATTLE' : 'BEAT THE STAGE BEFORE TO ENTER',
          title: `STAGE ${global}`,
          hp: `${formatNumber(army.hp)} HP`,
        }),
      )
      ;(k <= NEAR_GATES ? near : far).push({ k, door, sign })
      const rp = returnPad(k)
      list.push({
        x: rp.x,
        y: 4.2,
        z: rp.z,
        w: 5.6,
        h: 2,
        billboard: true,
        far: 40,
        draw: labelPanel('Return', returnLabel(worldId, k), { subFill: ['#fff36b', '#ffb300'], panel: 'rgba(16,20,40,0.35)' }),
      })
    }
    list.push({ x: 0, y: 8, z: gateZ(n + 1) + 2, w: 14, h: 3, billboard: true, draw: bannerText('WORLD COMPLETE!', ['#fff36b', '#ffb300']) })
    return { nearBoards: near, farBoards: far, farSigns: list }
  }, [n, world, worldId, doors])

  return (
    <group>
      <mesh geometry={geo.island} material={islandMaterials} receiveShadow />
      <mesh geometry={geo.paths} material={studMaterial(theme.path)} receiveShadow />
      <mesh geometry={geo.walls} material={studMaterial(theme.wall)} receiveShadow />
      <Arenas arenas={arenas} />
      {stageBlocks.map((blocks, i) => (
        <group
          key={i}
          ref={(el) => {
            stageGroups.current[i] = el
          }}
        >
          {(settled || inViewAtMount[i]) && <DecorBlocks blocks={blocks} />}
        </group>
      ))}
      <Doors doors={doors} />
      <ReturnPads worldId={worldId} pads={pads} />
      <PadFaces pads={padFaces} />
      <Champions worldId={worldId} n={n} />
      <StageFx worldId={worldId} n={n} />
      {/* Like the lobby's signs: drawn just after the first frame. */}
      <GateBoards items={playable ? nearBoards : NO_BOARDS} />
      {settled && <GateBoards items={farBoards} />}
      {settled && <Signs signs={farSigns} />}
    </group>
  )
}
