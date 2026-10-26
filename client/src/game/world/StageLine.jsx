import { useEffect, useMemo } from 'react'

import {
  DOOR,
  STAGE,
  WORLDS,
  arenaZ,
  enemyPad,
  formatNumber,
  gateZ,
  lineEndZ,
  playerPad,
  returnPad,
  stageArmy,
  stageCandy,
  stageDoor,
  stageWins,
} from '@shared'

import { useGameStore } from '../../store/gameStore'
import { live } from '../../store/live'
import { clearColliders, setColliders } from '../collision'
import { studMaterial } from '../render/materials'
import { THEMES } from '../sceneStyle'
import { createWorldBoxGeometry } from '../textures'
import { boxMatrix, mergedBoxes } from './parts/builders'
import { doorPillarCircles, doorScreenSign } from './parts/doorParts'
import { Doors } from './parts/Doors'
import { Arenas } from './parts/Instanced'
import { DecorBlocks } from './parts/Props'
import { ReturnPads } from './parts/ReturnPads'
import { Signs } from './parts/Signs'
import { bannerText, boardSign, labelPanel } from './parts/signStyles'

/**
 * One world's stages in a single straight line, running away from the spawn (-Z):
 *
 *   [gate 1] blue pad - ARENA 1 - red pad  [Return pad]  [gate 2] blue pad - ARENA 2 ...
 *
 * Touch a gate's glass to fight its stage from the blue pad behind it. Winning opens
 * that gate; the next one waits past the arena, with a Return pad in front of it to
 * cash out. The lobby builds Grassland's line in front of its spawn; the other worlds
 * build theirs the same way.
 */

const HALF = STAGE.islandHalfWidth
/** Outer half-width of a stage gate, frame included: the castle wall starts there. */
const GATE_HALF = STAGE.gateWidth / 2 + DOOR.pillar
/** The "KILL THE ENEMIES TO ENTER" board hung inside each gate. */
const BOARD = { y: 8.4, w: 11.5, h: 6.6 }
const WALL_HEIGHT = 8
/** Gates whose boards are drawn before the first frame (the ones visible from spawn). */
const NEAR_GATES = 2

/** Base reward a Return pad pays after clearing `k` stages (multipliers excluded). */
function returnLabel(worldId, k) {
  const w = WORLDS[worldId]
  let wins = 0
  let candy = 0
  for (let i = 1; i <= k; i += 1) {
    const s = w.event ? i : w.firstStage + i - 1
    wins += stageWins(worldId, s)
    candy += stageCandy(worldId, i)
  }
  return w.event ? `+${formatNumber(candy)} Candy` : `+${formatNumber(wins)} Win${wins === 1 ? '' : 's'}`
}

const PAD_TOP = STAGE.padTop

/** A blocky classic "noob" trainer standing on the red pad. */
function trainerBlocks(x, z, shirt) {
  const skin = '#ffd23a'
  const y = PAD_TOP
  return [
    { matrix: boxMatrix(x - 0.28, y + 0.55, z, 0.5, 1.1, 0.5), color: '#3fb34a' },
    { matrix: boxMatrix(x + 0.28, y + 0.55, z, 0.5, 1.1, 0.5), color: '#3fb34a' },
    { matrix: boxMatrix(x, y + 1.65, z, 1.1, 1.1, 0.55), color: shirt },
    { matrix: boxMatrix(x - 0.8, y + 1.65, z, 0.45, 1.1, 0.45), color: skin },
    { matrix: boxMatrix(x + 0.8, y + 1.65, z, 0.45, 1.1, 0.45), color: skin },
    { matrix: boxMatrix(x, y + 2.55, z, 0.75, 0.7, 0.75), color: skin },
  ]
}

/** A square pad with a yellow rim (blue = you, red = the enemy). */
function padBlocks(p, color) {
  const s = STAGE.padSize
  return [
    { matrix: boxMatrix(p.x, 0.15, p.z, s + 0.6, 0.3, s + 0.6), color: '#ffc21a' },
    { matrix: boxMatrix(p.x, 0.32, p.z, s, 0.34, s), color },
  ]
}

/** Each stage's gate: glass that opens once this run has beaten that stage. */
function stageDoors(worldId, n) {
  return Array.from({ length: n }, (_, i) => {
    const k = i + 1
    return {
      ...stageDoor(k),
      id: `gate-${k}`,
      kind: 'gate',
      board: BOARD,
      open: () => Boolean(live.run && live.run.world === worldId && live.run.cleared >= k),
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
      boxes.push({ minX: -HALF, maxX: -GATE_HALF + 0.4, minZ: gz - 0.8, maxZ: gz + 0.8, minY: -1, maxY: WALL_HEIGHT + 1 })
      boxes.push({ minX: GATE_HALF - 0.4, maxX: HALF, minZ: gz - 0.8, maxZ: gz + 0.8, minY: -1, maxY: WALL_HEIGHT + 1 })
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
      floors: [{ minX: -HALF, maxX: HALF, minZ: end, maxZ: start + 2, top: 0 }, ...floors],
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
  const doors = useMemo(() => stageDoors(worldId, n), [worldId, n])

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
      // Lane from the blue pad round the arena to that platform.
      paths.push({ x: 0, y: -0.035, z: gz - 4.5, w: STAGE.gateWidth, h: 0.12, d: 8 })
      walls.push({ x: -(HALF + GATE_HALF) / 2, y: WALL_HEIGHT / 2, z: gz, w: HALF - GATE_HALF, h: WALL_HEIGHT, d: 1.6 })
      walls.push({ x: (HALF + GATE_HALF) / 2, y: WALL_HEIGHT / 2, z: gz, w: HALF - GATE_HALF, h: WALL_HEIGHT, d: 1.6 })
    }
    return { island, paths: mergedBoxes(paths), walls: mergedBoxes(walls) }
  }, [n])
  useEffect(() => () => Object.values(geo).forEach((g) => g?.dispose()), [geo])

  const islandMaterials = useMemo(() => {
    const side = studMaterial(theme.edge)
    const top = studMaterial(theme.ground)
    return [side, side, top, side, side, side]
  }, [theme])

  const arenas = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => ({
        x: 0,
        z: arenaZ(i + 1),
        radius: STAGE.arenaRadius,
        floor: theme.arena,
        wall: theme.wall,
        trim: theme.trim,
      })),
    [n, theme],
  )

  const blocks = useMemo(() => {
    const out = []
    for (let k = 1; k <= n; k += 1) {
      const gz = gateZ(k)
      out.push(...padBlocks(playerPad(k), '#2f9bff'), ...padBlocks(enemyPad(k), '#e8243a'))
      const ep = enemyPad(k)
      out.push(...trainerBlocks(ep.x, ep.z, world.enemy.a))
      // Checkered start strip just past each gate.
      for (let row = 0; row < 2; row += 1) {
        for (let col = 0; col < 12; col += 1) {
          const white = (row + col) % 2 === 0
          out.push({
            matrix: boxMatrix(-8.25 + col * 1.5, 0, gz - 1.6 - row * 1.5, 1.5, 0.06, 1.5),
            color: white ? '#f4f6ff' : theme.path,
          })
        }
      }
      // Crenellated tops on the gate walls.
      for (const side of [-1, 1]) {
        for (let x = GATE_HALF + 1; x < HALF; x += 3) {
          out.push({ matrix: boxMatrix(side * x, WALL_HEIGHT + 0.5, gz, 1.6, 1, 1.8), color: '#ffd23a' })
        }
      }
      // Battlements along both island edges.
      for (let i = 0; i < 9; i += 1) {
        const z = gz - 3 - i * 6
        for (const x of [-HALF + 0.8, HALF - 0.8]) {
          out.push({ matrix: boxMatrix(x, 1, z, 1.6, 2, 1.6), color: theme.wall })
          out.push({ matrix: boxMatrix(x, 2.3, z, 1.7, 0.6, 1.7), color: i % 2 ? theme.trim : '#ffd23a' })
        }
      }
      if (decor) out.push(...decor(k, arenaZ(k)))
    }
    // Trophy statue at the end of the line.
    const fz = gateZ(n + 1) + 2
    out.push({ matrix: boxMatrix(0, 0.6, fz, 3.4, 1.2, 3.4), color: '#5f6fb0' })
    out.push({ matrix: boxMatrix(0, 2.2, fz, 1.4, 2, 1.4), color: '#ffd400' })
    out.push({ matrix: boxMatrix(0, 3.8, fz, 3, 1.4, 3), color: '#ffd400' })
    return out
  }, [n, world, theme, decor])

  const pads = useMemo(() => Array.from({ length: n }, (_, i) => ({ k: i + 1, ...returnPad(i + 1) })), [n])

  // The first gates' boards are drawn before the first frame; the rest of the line's
  // signs (further gates, Return labels) right after the game opens.
  const settled = useGameStore((s) => s.settled)
  const { nearSigns, farSigns } = useMemo(() => {
    const list = []
    const near = []
    for (let k = 1; k <= n; k += 1) {
      const target = k <= NEAR_GATES ? near : list
      const global = world.event ? k : world.firstStage + k - 1
      const army = stageArmy(worldId, global)
      target.push(
        doorScreenSign(
          doors[k - 1],
          boardSign(
            [
              { text: 'KILL THE ENEMIES TO ENTER', size: 0.15, fill: '#ffffff' },
              { text: `Stage ${global}`, size: 0.4, fill: '#ffffff' },
              { text: `${formatNumber(army.hp)} HP`, size: 0.36, fill: ['#ff7070', '#e8243a'], stroke: '#ffffff' },
            ],
            { bg: world.event ? '#5a2a86' : '#4b3fd1', border: world.event ? '#ff7a00' : '#2c2696' },
          ),
        ),
      )
      const rp = returnPad(k)
      list.push({
        x: rp.x,
        y: 4.2,
        z: rp.z,
        w: 5.6,
        h: 2,
        billboard: true,
        draw: labelPanel('Return', returnLabel(worldId, k), { subFill: ['#fff36b', '#ffb300'], panel: 'rgba(16,20,40,0.35)' }),
      })
    }
    list.push({ x: 0, y: 8, z: gateZ(n + 1) + 2, w: 14, h: 3, billboard: true, draw: bannerText('WORLD COMPLETE!', ['#fff36b', '#ffb300']) })
    return { nearSigns: near, farSigns: list }
  }, [n, world, worldId, doors])

  return (
    <group>
      <mesh geometry={geo.island} material={islandMaterials} receiveShadow />
      <mesh geometry={geo.paths} material={studMaterial(theme.path)} receiveShadow />
      <mesh geometry={geo.walls} material={studMaterial(theme.wall)} receiveShadow />
      <Arenas arenas={arenas} />
      <DecorBlocks blocks={blocks} />
      <Doors doors={doors} />
      <ReturnPads worldId={worldId} pads={pads} />
      <Signs signs={nearSigns} />
      {settled && <Signs signs={farSigns} />}
    </group>
  )
}
