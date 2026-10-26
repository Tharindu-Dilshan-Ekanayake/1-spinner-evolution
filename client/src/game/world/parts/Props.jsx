import { useEffect, useMemo, useRef } from 'react'
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Matrix4,
  MeshLambertMaterial,
  SphereGeometry,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { live } from '../../../store/live'
import { ORDER, useSystem } from '../../loop'
import { boxMatrix } from './builders'
import { InstancedSet } from './Instanced'
import { getBlockMaterial } from './shared'

/**
 * Decorations. Everything box-shaped (trees, flowers, logs, crates, lamp posts) goes
 * into ONE instanced set with per-instance colours; round things (pumpkins, graves)
 * get their own instanced meshes.
 */

/* ---------------------------------------------------------------------------
 * Box decor
 * ------------------------------------------------------------------------- */

/** All box decor in one draw call. */
export function DecorBlocks({ blocks, castShadow = false }) {
  return <InstancedSet items={blocks} material={getBlockMaterial()} castShadow={castShadow} />
}

/* ---------------------------------------------------------------------------
 * Pumpkins (collectible in the lobby, decoration elsewhere)
 * ------------------------------------------------------------------------- */

function colorize(g, hex) {
  const c = new Color(hex)
  const n = g.getAttribute('position').count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i += 1) {
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new Float32BufferAttribute(arr, 3))
  return g
}

let pumpkinGeometry = null
let pumpkinMaterial = null

function getPumpkin() {
  if (!pumpkinGeometry) {
    const body = new SphereGeometry(1, 12, 8)
    // Ribs: push vertices in and out around the equator.
    const pos = body.getAttribute('position')
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const a = Math.atan2(z, x)
      const k = 1 + Math.cos(a * 8) * 0.07
      pos.setXYZ(i, x * k * 1.15, pos.getY(i) * 0.78, z * k * 1.15)
    }
    body.computeVertexNormals()
    body.translate(0, 0.78, 0)
    const stem = new BoxGeometry(0.22, 0.45, 0.22).toNonIndexed()
    stem.translate(0, 1.7, 0)
    const parts = [colorize(body.toNonIndexed(), '#ff8a1c'), colorize(stem, '#3f8f2a')]
    for (const p of parts) p.deleteAttribute('uv')
    pumpkinGeometry = mergeGeometries(parts, false)
    pumpkinMaterial = new MeshLambertMaterial({ vertexColors: true })
  }
  return { geometry: pumpkinGeometry, material: pumpkinMaterial }
}

const _hidden = new Matrix4().makeScale(0, 0, 0)
const _m = new Matrix4()

/**
 * @param {{ items: Array<{ id?, x, z, s? }>, collectible?: boolean }} props
 *   collectible pumpkins hide while live.pumpkins says they're regrowing.
 */
export function Pumpkins({ items, collectible = false }) {
  const ref = useRef(null)
  const { geometry, material } = getPumpkin()
  const state = useRef([])

  const matrices = useMemo(
    () => items.map((p) => boxMatrix(p.x, 0, p.z, p.s || 1, p.s || 1, p.s || 1, (p.x * 13 + p.z) % 6)),
    [items],
  )

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    state.current = items.map(() => true)
  }, [matrices, items])

  useSystem(ORDER.world, () => {
    if (!collectible) return
    const mesh = ref.current
    if (!mesh) return
    const now = Date.now()
    let dirty = false
    for (let i = 0; i < items.length; i += 1) {
      const visible = (live.pumpkins[items[i].id] || 0) <= now
      if (visible !== state.current[i]) {
        state.current[i] = visible
        mesh.setMatrixAt(i, visible ? _m.copy(matrices[i]) : _hidden)
        dirty = true
      }
    }
    if (dirty) mesh.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={false} receiveShadow />
}

/* ---------------------------------------------------------------------------
 * Gravestones (Halloween corner and world)
 * ------------------------------------------------------------------------- */

let graveGeometry = null
function getGrave() {
  if (!graveGeometry) {
    const slab = new BoxGeometry(1.4, 1.6, 0.4)
    slab.translate(0, 0.8, 0)
    const top = new CylinderGeometry(0.7, 0.7, 0.4, 10, 1, false, 0, Math.PI)
    top.rotateX(Math.PI / 2)
    // Half-disc standing upright in the slab's plane, curved side up.
    top.rotateZ(Math.PI / 2)
    top.translate(0, 1.6, 0)
    const parts = [slab.toNonIndexed(), top.toNonIndexed()]
    for (const p of parts) p.deleteAttribute('uv')
    graveGeometry = mergeGeometries(parts, false)
  }
  return graveGeometry
}

export function Graves({ items, color = '#6d78a8' }) {
  const material = useMemo(() => new MeshLambertMaterial({ color }), [color])
  useEffect(() => () => material.dispose(), [material])
  const set = useMemo(
    () => items.map((g) => ({ matrix: boxMatrix(g.x, 0, g.z, g.s || 1, g.s || 1, g.s || 1, g.ry || 0) })),
    [items],
  )
  return <InstancedSet items={set} geometry={getGrave()} material={material} />
}
