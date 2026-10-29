import { useEffect, useMemo } from 'react'
import { MeshLambertMaterial } from 'three'

import { DOOR, STAGE, WORLDS, gateZ } from '@shared'

import { quality } from '../../store/qualityStore'
import { clearColliders, setColliders } from '../collision'
import { ORDER, useSystem } from '../loop'
import { SPRITE, fxBatch } from '../render/fxBatch'
import { studMaterial } from '../render/materials'
import { THEMES } from '../sceneStyle'
import { createWorldBoxGeometry } from '../textures'
import { doorPillarCircles, doorScreenSign } from './parts/doorParts'
import { Doors } from './parts/Doors'
import { DecorBlocks } from './parts/Props'
import { Signs } from './parts/Signs'
import { bannerText, boardSign } from './parts/signStyles'
import { PLAZA_DECOR } from './decor'
import StageLine from './StageLine'

/**
 * A world of its own (Lava, Galaxy): a spawn plaza with the door back to
 * the lobby, and the world's stages in a line straight ahead - the same StageLine the
 * lobby builds for Grassland.
 */

const HALF = STAGE.islandHalfWidth
/** The plaza runs from just behind the spawn to the first gate. */
const PLAZA = { minZ: gateZ(1) + 2, maxZ: 16 }

const EXIT = { ...STAGE.exitPortal, id: 'exit', kind: 'portal', color: '#2f9bff', screen: DOOR.screen }

/** Lava sea far below the Lava world's island. */
function LavaSea() {
  const material = useMemo(() => new MeshLambertMaterial({ color: '#ff4a00', emissive: '#ff3a00', emissiveIntensity: 1.2 }), [])
  useEffect(() => () => material.dispose(), [material])
  return (
    <mesh position={[0, -26, -200]} rotation={[-Math.PI / 2, 0, 0]} material={material}>
      <planeGeometry args={[900, 900]} />
    </mesh>
  )
}

/**
 * @param {{ worldId: string, decor?: (k, z) => Array }} props
 */
export default function StageWorld({ worldId, decor }) {
  const world = WORLDS[worldId]
  const theme = THEMES[world.theme === 'grass' ? 'grassland' : world.theme]

  // The plaza's walkway, lamps and set pieces (see decor.js).
  const dressing = useMemo(() => PLAZA_DECOR[worldId]?.(theme) || { blocks: [], circles: [], glows: [] }, [worldId, theme])
  // Its lamps, pools and spire tops glow, breathing slowly (not on LOW).
  useSystem(ORDER.world, () => {
    if (!quality().glow) return
    const t = performance.now() * 0.001
    const list = dressing.glows
    for (let i = 0; i < list.length; i += 1) {
      const g = list[i]
      const k = 0.85 + Math.sin(t * 1.8 + i * 1.3) * 0.15
      fxBatch.push(g.x, g.y, g.z, g.size, g.r, g.g, g.b, g.a * k, SPRITE.glow, g.flat)
    }
  })

  useEffect(() => {
    setColliders(`plaza:${worldId}`, {
      floors: [{ minX: -HALF, maxX: HALF, minZ: PLAZA.minZ, maxZ: PLAZA.maxZ, top: 0 }],
      // Low walls round the plaza's back and sides.
      boxes: [
        { minX: -HALF, maxX: HALF, minZ: PLAZA.maxZ - 1, maxZ: PLAZA.maxZ, minY: -1, maxY: 3 },
        { minX: -HALF - 1, maxX: -HALF + 0.8, minZ: PLAZA.minZ, maxZ: PLAZA.maxZ, minY: -1, maxY: 3 },
        { minX: HALF - 0.8, maxX: HALF + 1, minZ: PLAZA.minZ, maxZ: PLAZA.maxZ, minY: -1, maxY: 3 },
      ],
      circles: [...doorPillarCircles(EXIT), ...dressing.circles],
    })
    return () => clearColliders(`plaza:${worldId}`)
  }, [worldId, dressing])

  const plaza = useMemo(() => {
    const depth = PLAZA.maxZ - PLAZA.minZ
    const g = createWorldBoxGeometry(HALF * 2, 5, depth, 3)
    g.translate(0, -2.5, PLAZA.maxZ - depth / 2)
    return g
  }, [])
  useEffect(() => () => plaza.dispose(), [plaza])

  const islandMaterials = useMemo(() => {
    const side = studMaterial(theme.edge)
    const top = studMaterial(theme.ground)
    return [side, side, top, side, side, side]
  }, [theme])

  const signs = useMemo(
    () => [
      { x: 0, y: 19.6, z: gateZ(1) + 1, ry: 0, w: 16, h: 3, draw: bannerText(world.name.toUpperCase(), ['#ffffff', theme.trim], '#101030') },
      doorScreenSign(
        EXIT,
        boardSign([{ text: 'LOBBY', size: 0.5 }, { text: 'Back to the hub', size: 0.26, fill: '#bfe9ff' }], { bg: '#1f6fd6', border: '#7df9ff' }),
      ),
    ],
    [world, theme],
  )

  const doors = useMemo(() => [EXIT], [])

  return (
    <group>
      <mesh geometry={plaza} material={islandMaterials} receiveShadow />
      {dressing.blocks.length > 0 && <DecorBlocks blocks={dressing.blocks} />}
      <StageLine worldId={worldId} decor={decor} />
      <Doors doors={doors} />
      <Signs signs={signs} />
      {theme.lava && <LavaSea />}
    </group>
  )
}
