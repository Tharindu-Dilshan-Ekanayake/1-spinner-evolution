import { useMemo } from 'react'
import { LatheGeometry, MeshLambertMaterial, TorusGeometry, Vector2 } from 'three'

import { CAPSULES, CAPSULE_POSITIONS } from '@shared'

import { scaleMatrix } from './builders'
import { InstancedSet } from './Instanced'

/**
 * The Wins Shop's capsule machines, like the original's UFO capsules: a round base,
 * a saucer body in the capsule's colour with two gold stripes, and a glass dome on
 * top. Every machine shares four instanced draw calls.
 */

const lathe = (points, segments = 28) => new LatheGeometry(points.map(([x, y]) => new Vector2(x, y)), segments)

const baseGeometry = lathe([
  [0, 0.02],
  [2.75, 0.02],
  [2.85, 0.22],
  [2.6, 0.42],
  [0, 0.44],
])
const bodyGeometry = lathe([
  [0.4, 0.44],
  [1.7, 0.5],
  [2.05, 0.78],
  [2.12, 1.0],
  [1.98, 1.22],
  [1.5, 1.42],
  [0.9, 1.5],
])
const glassGeometry = lathe(
  [
    [0.98, 1.44],
    [0.9, 1.86],
    [0.62, 2.2],
    [0.3, 2.36],
    [0, 2.4],
  ],
  24,
)
/** Unit-radius stripe; scaled per stripe to sit on the saucer. */
const stripeGeometry = new TorusGeometry(1, 0.06, 6, 36)
stripeGeometry.rotateX(Math.PI / 2)

const solid = new MeshLambertMaterial({ color: '#ffffff' })
const glass = new MeshLambertMaterial({
  color: '#e4f6ff',
  emissive: '#5a7a99',
  transparent: true,
  opacity: 0.72,
})

/** @param {{ ids: string[] }} props */
export function CapsuleMachines({ ids }) {
  const { bases, bodies, stripes, domes } = useMemo(() => {
    const bases = []
    const bodies = []
    const stripes = []
    const domes = []
    for (const id of ids) {
      const p = CAPSULE_POSITIONS[id]
      const c = CAPSULES[id]
      if (!p || !c) continue
      bases.push({ matrix: scaleMatrix(p.x, 0, p.z, 1, 1, 1), color: id === 'halloween' ? '#b03cf0' : '#3cd05a' })
      bodies.push({ matrix: scaleMatrix(p.x, 0, p.z, 1, 1, 1), color: c.color })
      stripes.push({ matrix: scaleMatrix(p.x, 0.9, p.z, 2.1, 1, 2.1), color: '#ffd23a' })
      stripes.push({ matrix: scaleMatrix(p.x, 1.2, p.z, 1.99, 1, 1.99), color: '#ffd23a' })
      domes.push({ matrix: scaleMatrix(p.x, 0, p.z, 1, 1, 1) })
    }
    return { bases, bodies, stripes, domes }
  }, [ids])

  return (
    <>
      <InstancedSet items={bases} geometry={baseGeometry} material={solid} />
      <InstancedSet items={bodies} geometry={bodyGeometry} material={solid} castShadow />
      <InstancedSet items={stripes} geometry={stripeGeometry} material={solid} />
      <InstancedSet items={domes} geometry={glassGeometry} material={glass} />
    </>
  )
}
