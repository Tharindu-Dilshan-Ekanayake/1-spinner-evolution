import { useMemo } from 'react'
import { Color, Float32BufferAttribute, LatheGeometry, MeshLambertMaterial, Vector2 } from 'three'

import { PALETTE } from '../../sceneStyle'
import { scaleMatrix } from './builders'
import { STAND, dishHeight } from './standParts'
import { InstancedSet } from './Instanced'

/**
 * The Spinners Shop's pads (once the capsule machines, so the code keeps that name):
 * each is a little spinner stadium for one spinner. A white plinth with a navy band
 * carries a bowl walled in the tier's colour with a gold rim; inside, a grey dish with
 * a groove where that spinner really spins (see Lobby.jsx drawPrizes). There are ~40,
 * so they're lean: two draw calls for all of them, under 500 triangles each.
 */

/** Sides round each pad. */
const SEGMENTS = 16

/**
 * A lathe whose profile points carry colours: [x, y, colour]. Colours change over the
 * segment between two points, so a 1-2 cm step gives a clean edge.
 */
function colouredLathe(points) {
  const g = new LatheGeometry(points.map(([x, y]) => new Vector2(x, y)), SEGMENTS)
  const cols = points.map(([, , hex]) => new Color(hex))
  const n = g.getAttribute('position').count
  const arr = new Float32Array(n * 3)
  for (let v = 0; v < n; v += 1) {
    const c = cols[v % points.length]
    arr[v * 3] = c.r
    arr[v * 3 + 1] = c.g
    arr[v * 3 + 2] = c.b
  }
  g.setAttribute('color', new Float32BufferAttribute(arr, 3))
  return g
}

const R = STAND.radius
const H = STAND.height
const W = '#ffffff'
const N = PALETTE.navy
const G = PALETTE.gold
const DISH = '#e3e9f2'
const GROOVE = '#b4c0d6'
const POCKET = '#8e9cb8'
/** Where the bowl's wall starts (on the navy band) and its rim's inner edge. */
const WALL = { r: R * 0.86, y: 0.36 }
const RIM = R * 0.7

/** Plinth (white step, navy band), gold rim and the dish, in one geometry. */
const baseGeometry = colouredLathe([
  // Open underneath: it stands on the ground.
  [R, 0, W],
  [R, 0.18, W],
  [R * 0.92, 0.21, W],
  [R * 0.9, 0.22, N],
  [WALL.r, WALL.y, N],
  // Up inside the bowl's wall (hidden by it) to the gold rim on top.
  [RIM + 0.12, H, G],
  [RIM, H, G],
  [RIM - 0.03, H - 0.03, DISH],
  [0.62, dishHeight(0.62), DISH],
  [0.55, dishHeight(0.55), GROOVE],
  [0.48, dishHeight(0.48), DISH],
  [0.2, dishHeight(0.2), DISH],
  [0.16, dishHeight(0.16), POCKET],
  [0, dishHeight(0), POCKET],
])

/** The bowl's outer wall, in the tier's colour (up to the gold rim). */
const wallGeometry = new LatheGeometry(
  [
    [WALL.r, WALL.y],
    [WALL.r - 0.06, H - 0.12],
    [RIM + 0.12, H],
  ].map(([x, y]) => new Vector2(x, y)),
  SEGMENTS,
)

const baseMaterial = new MeshLambertMaterial({ color: '#ffffff', vertexColors: true })
const solid = new MeshLambertMaterial({ color: '#ffffff' })

/** @param {{ pads: Array<{ x: number, z: number, scale: number, color: string, tier: string }> }} props (see shopPadList) */
export function CapsuleMachines({ pads }) {
  const { bases, walls } = useMemo(() => {
    const bases = []
    const walls = []
    for (const p of pads) {
      const m = scaleMatrix(p.x, 0, p.z, p.scale, p.scale, p.scale)
      bases.push({ matrix: m })
      walls.push({ matrix: m, color: p.color })
    }
    return { bases, walls }
  }, [pads])

  return (
    <>
      <InstancedSet items={bases} geometry={baseGeometry} material={baseMaterial} castShadow />
      <InstancedSet items={walls} geometry={wallGeometry} material={solid} castShadow />
    </>
  )
}
