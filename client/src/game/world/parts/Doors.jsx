import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
} from 'three'

import { DOOR } from '@shared'

import { sfx } from '../../../audio/sfx'
import { ORDER, useSystem } from '../../loop'
import { glowMaterial } from '../../render/materials'
import { doorBox, doorwayHeight } from './doorParts'
import { InstancedSet } from './Instanced'
import { getBlockMaterial } from './shared'

/**
 * The big gates from the original game: a studded brick frame with a glowing neon
 * inner edge and a display - across the top (door.screen) or a board hung in the
 * opening (door.board), drawn by the world's Signs. The doorway is either
 *
 *   kind 'gate'   - a glass door that slides down into the floor once `open()` is true
 *                   (each stage's own door), and back up when it isn't
 *   kind 'portal' - a swirling doorway you walk into (world entrances, back to lobby)
 *
 * door = { id, x, z, ry, width, height, kind, color, screen?, board?: { y, w, h },
 *          open?: () => boolean }
 * Every door in a world shares the same few draw calls.
 */

const OPEN_SECONDS = 0.9
const NEON = '#ffb21a'
const PANEL = '#1d2350'

const plane = new PlaneGeometry(1, 1)

/** Swirl for walk-in doorways; uv-based so any door size works. */
const swirlMaterial = new ShaderMaterial({
  uniforms: { time: { value: 0 } },
  vertexShader: /* glsl */ `
    attribute vec3 iTint;
    varying vec2 vUv;
    varying vec3 vTint;
    void main() {
      vUv = uv * 2.0 - 1.0;
      vTint = iTint;
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float time;
    varying vec2 vUv;
    varying vec3 vTint;
    void main() {
      float r = length(vUv);
      float a = atan(vUv.y, vUv.x);
      float s = sin(a * 3.0 + r * 8.0 - time * 3.0) * 0.5 + 0.5;
      float edge = max(abs(vUv.x), abs(vUv.y));
      vec3 col = mix(vTint * 0.7, vec3(1.0), s * 0.5) * (0.7 + (1.0 - r) * 0.6);
      gl_FragColor = vec4(col, 0.85 * smoothstep(1.0, 0.82, edge));
    }
  `,
  transparent: true,
  side: DoubleSide,
  depthWrite: false,
  blending: AdditiveBlending,
})

const glassMaterial = new MeshBasicMaterial({
  color: '#bfe6ff',
  transparent: true,
  opacity: 0.38,
  side: DoubleSide,
  depthWrite: false,
})

/** Unlit, so each door's instance colour shows at full neon brightness. */
const neonMaterial = new MeshBasicMaterial({ color: '#ffffff', toneMapped: false })

const _hidden = new Matrix4().makeScale(0, 0, 0)
const _m = new Matrix4()

function Frames({ doors }) {
  const { bricks, neon, panels } = useMemo(() => {
    const bricks = []
    const neon = []
    const panels = []
    const P = DOOR.pillar
    const D = DOOR.depth
    for (const d of doors) {
      const w = d.width
      const h = d.height
      const pillarX = w / 2 + P / 2
      bricks.push({ matrix: doorBox(d, -pillarX, (h + P) / 2, 0, P, h + P, D), color: '#7d8bd4' })
      bricks.push({ matrix: doorBox(d, pillarX, (h + P) / 2, 0, P, h + P, D), color: '#7d8bd4' })
      bricks.push({ matrix: doorBox(d, 0, h + P / 2, 0, w + P * 2, P, D), color: '#8e9be0' })
      // Display backing: across the top of the opening, or a board hung inside it.
      if (d.screen) panels.push({ matrix: doorBox(d, 0, h - d.screen / 2, 0, w, d.screen, 0.5) })
      if (d.board) panels.push({ matrix: doorBox(d, 0, d.board.y, 0, d.board.w, d.board.h, 0.5) })
      // Glowing inner edge all round the opening, like the original's neon trim.
      const t = 0.28
      const color = d.kind === 'portal' ? d.color : NEON
      neon.push({ matrix: doorBox(d, -w / 2 + t / 2, h / 2, 0, t, h, D + 0.12), color })
      neon.push({ matrix: doorBox(d, w / 2 - t / 2, h / 2, 0, t, h, D + 0.12), color })
      neon.push({ matrix: doorBox(d, 0, h - t / 2, 0, w, t, D + 0.12), color })
      if (d.screen) neon.push({ matrix: doorBox(d, 0, h - d.screen - t / 2, 0, w, t, D + 0.12), color })
    }
    return { bricks, neon, panels }
  }, [doors])

  return (
    <>
      <InstancedSet items={bricks} material={getBlockMaterial()} castShadow />
      <InstancedSet items={neon} material={neonMaterial} />
      <InstancedSet items={panels} material={glowMaterial(PANEL, 0.15)} />
    </>
  )
}

/** Glass gates: slide down when open() becomes true, up again when it doesn't. */
function Glass({ doors }) {
  const ref = useRef(null)
  const state = useRef([])
  const items = useMemo(() => doors.map((d) => ({ d, h: doorwayHeight(d) })), [doors])

  useEffect(() => {
    state.current = doors.map((d) => ({ k: d.open?.() ? 1 : 0, shown: -1 }))
  }, [doors])

  useSystem(ORDER.world, (dt) => {
    const mesh = ref.current
    if (!mesh) return
    let dirty = false
    let opened = false
    for (let i = 0; i < items.length; i += 1) {
      const st = state.current[i]
      if (!st) continue
      const { d, h } = items[i]
      const target = d.open?.() ? 1 : 0
      if (st.k !== target) {
        if (target === 1 && st.k === 0) opened = true
        st.k = target > st.k ? Math.min(1, st.k + dt / OPEN_SECONDS) : Math.max(0, st.k - dt / OPEN_SECONDS)
      }
      if (st.k === st.shown) continue
      st.shown = st.k
      dirty = true
      if (st.k >= 1) {
        mesh.setMatrixAt(i, _hidden)
      } else {
        // Sink into the floor (the island hides it), easing out.
        const e = 1 - (1 - st.k) * (1 - st.k)
        mesh.setMatrixAt(i, doorBox(d, 0, h / 2 - e * h, 0, d.width, h, 1, _m))
      }
    }
    if (dirty) mesh.instanceMatrix.needsUpdate = true
    if (opened) sfx.door()
  })

  if (!doors.length) return null
  return <instancedMesh ref={ref} args={[plane, glassMaterial, doors.length]} frustumCulled={false} />
}

/** Swirling walk-in doorways. */
function Swirls({ doors }) {
  const ref = useRef(null)
  const geometry = useMemo(() => plane.clone(), [])
  useEffect(() => () => geometry.dispose(), [geometry])

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const tints = new Float32Array(doors.length * 3)
    const c = new Color()
    doors.forEach((d, i) => {
      const h = doorwayHeight(d)
      mesh.setMatrixAt(i, doorBox(d, 0, h / 2, 0, d.width, h, 1))
      c.set(d.color)
      tints[i * 3] = c.r
      tints[i * 3 + 1] = c.g
      tints[i * 3 + 2] = c.b
    })
    mesh.geometry.setAttribute('iTint', new InstancedBufferAttribute(tints, 3))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [doors])

  useSystem(ORDER.world, (dt) => {
    swirlMaterial.uniforms.time.value += dt
  })

  if (!doors.length) return null
  return <instancedMesh ref={ref} args={[geometry, swirlMaterial, doors.length]} />
}

export function Doors({ doors }) {
  const gates = useMemo(() => doors.filter((d) => d.kind === 'gate'), [doors])
  const portals = useMemo(() => doors.filter((d) => d.kind === 'portal'), [doors])
  return (
    <>
      <Frames doors={doors} />
      <Glass doors={gates} />
      <Swirls doors={portals} />
    </>
  )
}

export default Doors

