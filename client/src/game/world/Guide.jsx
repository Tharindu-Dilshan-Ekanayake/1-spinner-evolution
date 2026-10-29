import { useMemo, useRef } from 'react'
import {
  Color,
  Euler,
  ExtrudeGeometry,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Shape,
  Vector3,
} from 'three'

import { useGameStore } from '../../store/gameStore'
import { live } from '../../store/live'
import { groundAt } from '../collision'
import { tutorialTarget } from '../guide'
import { ORDER, useSystem } from '../loop'
import { overlay } from '../overlay/worldOverlay'

/**
 * The first-time tutorial's guide arrows: a big gold arrow bobbing over where to go
 * next, and a trail of arrows on the ground leading there from your feet, scrolling
 * towards it. All of them are instances of one small arrow mesh - one draw call.
 *
 * The target is re-picked a few times a second (see game/guide.js); while fighting,
 * training at the right pad, standing at the capsule, or once the tutorial is done,
 * nothing shows.
 */

const TRAIL = 7
const SPACING = 2.4
const TRAIL_START = 1.8
const REPICK_S = 0.25
/** Closer than this, you've arrived: only the big arrow stays, then that goes too. */
const ARRIVED = 2.6

function arrowGeometry() {
  const shape = new Shape()
  shape.moveTo(-0.22, -0.7)
  shape.lineTo(0.22, -0.7)
  shape.lineTo(0.22, 0.05)
  shape.lineTo(0.55, 0.05)
  shape.lineTo(0, 0.75)
  shape.lineTo(-0.55, 0.05)
  shape.lineTo(-0.22, 0.05)
  shape.closePath()
  const g = new ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false }).toNonIndexed()
  g.translate(0, 0, -0.09)
  g.deleteAttribute('uv')
  // Gold faces, deeper orange sides: reads as a chunky 3D arrow without lighting.
  const face = new Color('#ffd21f')
  const side = new Color('#e07800')
  const normals = g.getAttribute('normal')
  const colors = new Float32Array(normals.count * 3)
  for (let i = 0; i < normals.count; i += 1) {
    const c = Math.abs(normals.getZ(i)) > 0.5 ? face : side
    colors.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return g
}

let shared = null
function getArrow() {
  if (!shared) shared = { geometry: arrowGeometry(), material: new MeshBasicMaterial({ vertexColors: true }) }
  return shared
}

const _m = new Matrix4()
const _p = new Vector3()
const _q = new Quaternion()
const _s = new Vector3()
const _e = new Euler()
const _hidden = new Matrix4().makeScale(0, 0, 0)

export function Guide() {
  const mesh = useMemo(() => {
    const { geometry, material } = getArrow()
    const m = new InstancedMesh(geometry, material, TRAIL + 1)
    for (let i = 0; i <= TRAIL; i += 1) m.setMatrixAt(i, _hidden)
    // Instances roam the whole map; the mesh's own bounds would cull them wrongly.
    m.frustumCulled = false
    return m
  }, [])
  const ref = useRef(null)
  const state = useRef({ target: null, wait: 0 })

  useSystem(ORDER.world, (dt, three) => {
    const arrows = ref.current
    if (!arrows) return
    const st = state.current
    const p = live.player
    st.wait -= dt
    if (st.wait <= 0) {
      st.wait = REPICK_S
      const g = useGameStore.getState()
      st.target = live.battle ? null : tutorialTarget({ profile: g.profile, zone: live.zone, run: live.run })
      // Already training at the ring we'd point to: nothing to show.
      if (st.target?.ring && live.ring === st.target.ring) st.target = null
    }
    const target = st.target
    const t = performance.now() * 0.001

    let used = 0
    const dx = target ? target.x - p.x : 0
    const dz = target ? target.z - p.z : 0
    const dist = Math.hypot(dx, dz)
    if (target && dist >= (target.reach || 0)) {

      // The big arrow over the target: bobbing, turning, pointing down.
      const bob = Math.sin(t * 3) * 0.35
      _p.set(target.x, (target.y || 0) + 3.4 + bob, target.z)
      _e.set(0, t * 1.8, Math.PI, 'YXZ')
      _q.setFromEuler(_e)
      _s.setScalar(1.7)
      arrows.setMatrixAt(used, _m.compose(_p, _q, _s))
      used += 1
      overlay.name(three.camera, target.x, (target.y || 0) + 5.4 + bob, target.z, target.label)

      // The trail on the ground, scrolling towards the target.
      if (dist > ARRIVED + TRAIL_START) {
        const ux = dx / dist
        const uz = dz / dist
        const yaw = Math.atan2(-dx, -dz)
        const scroll = (t * 2.2) % SPACING
        for (let i = 0; i < TRAIL && used <= TRAIL; i += 1) {
          const d = TRAIL_START + i * SPACING + scroll
          if (d > dist - ARRIVED) break
          const x = p.x + ux * d
          const z = p.z + uz * d
          // Grow in near your feet, shrink out at the far end of the trail.
          const k = Math.min(1, (d - TRAIL_START) / 1.2, (TRAIL_START + TRAIL * SPACING - d) / 2.4)
          _p.set(x, groundAt(x, z, p.y + 1) + 0.07, z)
          _e.set(-Math.PI / 2, yaw, 0, 'YXZ')
          _q.setFromEuler(_e)
          _s.setScalar(0.95 * Math.max(0, k))
          arrows.setMatrixAt(used, _m.compose(_p, _q, _s))
          used += 1
        }
      }
    }
    for (let i = used; i <= TRAIL; i += 1) arrows.setMatrixAt(i, _hidden)
    arrows.instanceMatrix.needsUpdate = true
  })

  return <primitive ref={ref} object={mesh} />
}

export default Guide
