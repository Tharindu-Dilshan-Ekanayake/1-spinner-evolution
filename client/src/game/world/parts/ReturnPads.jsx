import { useEffect, useMemo, useRef } from 'react'
import {
  Color,
  Float32BufferAttribute,
  LatheGeometry,
  Matrix4,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Quaternion,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { STAGE } from '@shared'

import { live } from '../../../store/live'
import { quality } from '../../../store/qualityStore'
import { ORDER, useSystem } from '../../loop'
import { SPRITE, fxBatch } from '../../render/fxBatch'
import { fx } from '../../render/particles'
import { InstancedSet } from './Instanced'
import { scaleMatrix } from './builders'

/**
 * The yellow Return pads ("Return / +7 Wins"): step on one to cash out the run and go
 * back to the lobby. A glowing gold pad on a navy base, three little trophies circling
 * above it, a pulsing ring on the floor and sparkles rising off it.
 *
 * Pads that would pay out right now (this run has cleared that far) glow brighter.
 */

const TROPHIES_PER_PAD = 3

function colorize(geometry, hex) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry
  g.deleteAttribute('uv')
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

const lathe = (points, segments = 28) => new LatheGeometry(points.map(([x, y]) => new Vector2(x, y)), segments)

/** Navy base ring + gold rim + bright domed top, one geometry with vertex colours. */
function buildPad() {
  const R = STAGE.returnPadRadius
  // A low step (top at STAGE.returnPadTop) so you walk straight onto it.
  const base = lathe([
    [0, 0.02],
    [R + 0.7, 0.02],
    [R + 0.7, 0.18],
    [R + 0.45, 0.22],
    [0, 0.22],
  ])
  const rim = lathe([
    [R + 0.15, 0.2],
    [R + 0.15, 0.35],
    [R - 0.05, 0.41],
    [R - 0.35, 0.41],
  ])
  const top = lathe([
    [R - 0.3, 0.38],
    [R - 0.6, 0.43],
    [R * 0.5, 0.455],
    [0, STAGE.returnPadTop],
  ])
  const merged = mergeGeometries([colorize(base, '#24306e'), colorize(rim, '#e8a800'), colorize(top, '#ffe14d')], false)
  merged.computeVertexNormals()
  return merged
}

/** A small gold cup on a stem and base. */
function buildTrophy() {
  const cup = lathe(
    [
      [0, 0],
      [0.28, 0],
      [0.28, 0.07],
      [0.1, 0.12],
      [0.07, 0.32],
      [0.14, 0.4],
      [0.34, 0.5],
      [0.38, 0.86],
      [0.32, 0.86],
      [0.27, 0.56],
      [0, 0.5],
    ],
    12,
  )
  const handleL = new TorusGeometry(0.13, 0.035, 5, 10)
  handleL.translate(-0.38, 0.66, 0)
  const handleR = handleL.clone()
  handleR.translate(0.76, 0, 0)
  const merged = mergeGeometries([colorize(cup, '#ffcf2e'), colorize(handleL, '#f2b400'), colorize(handleR, '#f2b400')], false)
  merged.computeVertexNormals()
  return merged
}

// Built once and kept for the session (every world reuses them).
const padGeometry = buildPad()
const trophyGeometry = buildTrophy()
const padMaterial = new MeshBasicMaterial({ vertexColors: true, toneMapped: false })
const trophyMaterial = new MeshLambertMaterial({ vertexColors: true, emissive: '#7a5200' })

const _m = new Matrix4()
const _p = new Vector3()
const _q = new Quaternion()
const _s = new Vector3()
const _up = new Vector3(0, 1, 0)

/**
 * @param {{ worldId: string, pads: Array<{ k: number, x: number, z: number }> }} props
 *   k = the stage whose platform the pad is on (pays once the run has cleared k).
 */
export function ReturnPads({ worldId, pads }) {
  const trophiesRef = useRef(null)
  const count = pads.length * TROPHIES_PER_PAD

  const bases = useMemo(() => pads.map((p) => ({ matrix: scaleMatrix(p.x, 0.02, p.z, 1, 1, 1) })), [pads])

  useEffect(() => {
    trophiesRef.current?.computeBoundingSphere()
  }, [pads])

  useSystem(ORDER.world, (dt) => {
    const t = performance.now() * 0.001
    const mesh = trophiesRef.current
    const run = live.run && live.run.world === worldId ? live.run : null
    const cleared = run ? run.cleared : 0
    const q = quality()
    const px = live.player.x
    const pz = live.player.z
    const far = q.viewDistance * q.viewDistance
    for (let i = 0; i < pads.length; i += 1) {
      const pad = pads[i]
      const active = pad.k <= cleared
      const dx = pad.x - px
      const dz = pad.z - pz
      const near = dx * dx + dz * dz < far
      // Trophies circling and bobbing above the pad.
      if (mesh) {
        for (let j = 0; j < TROPHIES_PER_PAD; j += 1) {
          const a = t * 1.3 + (j / TROPHIES_PER_PAD) * Math.PI * 2 + i
          _p.set(pad.x + Math.cos(a) * 1.1, 1.6 + Math.sin(t * 2.4 + j * 2) * 0.22, pad.z + Math.sin(a) * 1.1)
          _q.setFromAxisAngle(_up, -a + t * 2)
          const sc = near ? (active ? 0.85 : 0.6) : 0
          _s.set(sc, sc, sc)
          mesh.setMatrixAt(i * TROPHIES_PER_PAD + j, _m.compose(_p, _q, _s))
        }
      }
      if (!near) continue
      const pulse = 0.5 + 0.5 * Math.sin(t * 3 + i)
      const glow = active ? 1 : 0.45
      fxBatch.push(pad.x, 0.5, pad.z, STAGE.returnPadRadius * 2.6 * (1 + pulse * 0.2), 1, 0.85, 0.2, (0.45 + pulse * 0.35) * glow, SPRITE.ring, true, t)
      fxBatch.push(pad.x, 1.2, pad.z, 5.5, 1, 0.8, 0.25, 0.28 * glow, SPRITE.glow, false, 0, 1.4)
      if (active && Math.random() < dt * 5) {
        fx.sparkle(pad.x + (Math.random() - 0.5) * 3.6, 1, pad.z + (Math.random() - 0.5) * 3.6, 1, 0.85, 0.3)
      }
    }
    if (mesh) mesh.instanceMatrix.needsUpdate = true
  })

  if (!pads.length) return null
  return (
    <>
      <InstancedSet items={bases} geometry={padGeometry} material={padMaterial} />
      <instancedMesh ref={trophiesRef} args={[trophyGeometry, trophyMaterial, count]} frustumCulled={false} />
    </>
  )
}

export default ReturnPads
