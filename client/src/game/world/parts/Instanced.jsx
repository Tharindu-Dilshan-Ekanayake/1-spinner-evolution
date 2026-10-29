import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, MeshLambertMaterial } from 'three'

import { getArenaTexture, ringBlocks, scaleMatrix } from './builders'
import { getBlockMaterial, unitBox, unitCylinder } from './shared'

/**
 * Instanced building blocks: hundreds of repeated objects, one draw call each.
 */

/**
 * Generic instanced mesh from a list of { matrix, color? }.
 * Geometry/material are owned by the caller (shared ones are never disposed here).
 */
export function InstancedSet({ items, geometry = unitBox, material, castShadow = false, receiveShadow = true }) {
  const ref = useRef(null)
  const colored = items.some((it) => it.color)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const c = new Color()
    items.forEach((it, i) => {
      mesh.setMatrixAt(i, it.matrix)
      if (colored) mesh.setColorAt(i, c.set(it.color || '#ffffff'))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items, colored])

  if (!items.length) return null
  return (
    <instancedMesh
      key={items.length}
      ref={ref}
      args={[geometry, material, items.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  )
}

let dishMaterial = null
function getDishMaterial() {
  if (!dishMaterial) {
    dishMaterial = new MeshLambertMaterial({ map: getArenaTexture(), color: '#ffffff' })
  }
  return dishMaterial
}

/**
 * Round arenas: dish floor + castle wall + coloured trim, for any number of arenas in
 * three draw calls total. Floors top out at y = 0.15 (spinners stand on that).
 *
 * @param {{ arenas: Array<{ x, z, radius, floor, wall, trim }>, castShadow?: boolean }} props
 */
export function Arenas({ arenas, castShadow = false }) {
  const { floors, walls, trims } = useMemo(() => {
    const floors = []
    const walls = []
    const trims = []
    for (const a of arenas) {
      const dish = scaleMatrix(a.x, 0, a.z, a.radius, 0.3, a.radius)
      floors.push({ matrix: dish, color: a.floor })
      const wallR = a.radius + 0.7
      for (const m of ringBlocks(a.x, a.z, wallR, { height: 1.25, depth: 1.1 })) walls.push({ matrix: m, color: a.wall })
      for (const m of ringBlocks(a.x, a.z, wallR, { height: 0.32, depth: 1.25, y: 1.25 })) trims.push({ matrix: m, color: a.trim })
    }
    return { floors, walls, trims }
  }, [arenas])

  return (
    <>
      <InstancedSet items={floors} geometry={unitCylinder} material={getDishMaterial()} />
      <InstancedSet items={walls} material={getBlockMaterial()} castShadow={castShadow} />
      <InstancedSet items={trims} material={getBlockMaterial()} />
    </>
  )
}

