import { useEffect, useMemo } from 'react'
import { MeshLambertMaterial } from 'three'

import { DOOR, STAGE, WORLDS, gateZ } from '@shared'

import { clearColliders, setColliders } from '../collision'
import { studMaterial } from '../render/materials'
import { THEMES } from '../sceneStyle'
import { createWorldBoxGeometry } from '../textures'
import { doorPillarCircles, doorScreenSign } from './parts/doorParts'
import { Doors } from './parts/Doors'
import { Graves, Pumpkins } from './parts/Props'
import { Signs } from './parts/Signs'
import { bannerText, boardSign } from './parts/signStyles'
import StageLine from './StageLine'

/**
 * A world of its own (Lava, Galaxy, Halloween): a spawn plaza with the door back to
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
 * @param {{ worldId: string, decor?: (k, z) => Array, extras?: { pumpkins(n), graves(n) } }} props
 */
export default function StageWorld({ worldId, decor, extras }) {
  const world = WORLDS[worldId]
  const theme = THEMES[world.theme === 'grass' ? 'grassland' : world.theme]
  const n = world.stageCount

  useEffect(() => {
    setColliders(`plaza:${worldId}`, {
      floors: [{ minX: -HALF, maxX: HALF, minZ: PLAZA.minZ, maxZ: PLAZA.maxZ, top: 0 }],
      // Low walls round the plaza's back and sides.
      boxes: [
        { minX: -HALF, maxX: HALF, minZ: PLAZA.maxZ - 1, maxZ: PLAZA.maxZ, minY: -1, maxY: 3 },
        { minX: -HALF - 1, maxX: -HALF + 0.8, minZ: PLAZA.minZ, maxZ: PLAZA.maxZ, minY: -1, maxY: 3 },
        { minX: HALF - 0.8, maxX: HALF + 1, minZ: PLAZA.minZ, maxZ: PLAZA.maxZ, minY: -1, maxY: 3 },
      ],
      circles: doorPillarCircles(EXIT),
    })
    return () => clearColliders(`plaza:${worldId}`)
  }, [worldId])

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
      { x: 0, y: 16.5, z: gateZ(1) + 1, ry: 0, w: 16, h: 3, draw: bannerText(world.name.toUpperCase(), ['#ffffff', theme.trim], '#101030') },
      doorScreenSign(
        EXIT,
        boardSign([{ text: 'LOBBY', size: 0.5 }, { text: 'Back to the hub', size: 0.26, fill: '#bfe9ff' }], { bg: '#1f6fd6', border: '#7df9ff' }),
      ),
    ],
    [world, theme],
  )

  const doors = useMemo(() => [EXIT], [])
  const pumpkins = useMemo(() => (extras?.pumpkins ? extras.pumpkins(n) : []), [extras, n])
  const graves = useMemo(() => (extras?.graves ? extras.graves(n) : []), [extras, n])

  return (
    <group>
      <mesh geometry={plaza} material={islandMaterials} receiveShadow />
      <StageLine worldId={worldId} decor={decor} />
      <Doors doors={doors} />
      <Signs signs={signs} />
      {pumpkins.length > 0 && <Pumpkins items={pumpkins} />}
      {graves.length > 0 && <Graves items={graves} />}
      {theme.lava && <LavaSea />}
    </group>
  )
}
