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
import { PALETTE } from '../../sceneStyle'
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
/** Height of the board across the top of every door frame. */
const LINTEL = 2.6
/** The TRAIN POWER arch colours; stage lines pass their world's own (door.colors). */
const ARCH_COLORS = { base: PALETTE.navy, band: PALETTE.white, body: PALETTE.blue, cap: PALETTE.gold, light: PALETTE.sky }
const NEON = '#ffb21a'
const PANEL = PALETTE.navy

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
      const c = d.colors || ARCH_COLORS
      // Built like the TRAIN POWER arch: striped pillars on plinths with cap blocks, and
      // a navy board in a frame across the top with a light strip and a row of lights.
      const top = h + LINTEL
      const bands = Math.max(3, Math.round((top - 1) / 1.3))
      const band = (top - 1) / bands
      for (const x of [-pillarX, pillarX]) {
        bricks.push({ matrix: doorBox(d, x, 0.45, 0, P + 0.8, 0.9, D + 0.8), color: c.base })
        bricks.push({ matrix: doorBox(d, x, 0.97, 0, P + 0.4, 0.14, D + 0.4), color: c.band })
        for (let i = 0; i < bands; i += 1) {
          bricks.push({ matrix: doorBox(d, x, 1 + band * (i + 0.5), 0, P, band, D), color: i % 2 ? c.band : c.body })
        }
        // Collar 15 cm inside the cap's faces (closer flickers at a distance).
        bricks.push({ matrix: doorBox(d, x, top + 0.12, 0, P + 0.1, 0.24, D + 0.1), color: c.base })
        bricks.push({ matrix: doorBox(d, x, top + 1.0, 0, P + 0.4, P + 0.4, D + 0.4), color: c.cap })
      }
      // The lintel and its cap span the opening only, ending inside the pillars and
      // their caps: running across the pillars, their faces lined up with the pillars'.
      bricks.push({ matrix: doorBox(d, 0, h + LINTEL / 2, 0, w, LINTEL, D - 0.1), color: c.body })
      bricks.push({ matrix: doorBox(d, 0, h + LINTEL / 2 + 0.1, 0, w - 0.4, LINTEL - 0.8, D + 0.2), color: c.base })
      bricks.push({ matrix: doorBox(d, 0, h + 0.3, 0, w - 0.8, 0.22, D + 0.25), color: c.light })
      bricks.push({ matrix: doorBox(d, 0, top + 0.15, 0, w, 0.3, D), color: c.cap })
      for (let x = -w / 2 + 1, i = 0; x <= w / 2 - 1; x += 2, i += 1) {
        bricks.push({ matrix: doorBox(d, x, top - 0.25, (D + 0.2) / 2 + 0.07, 0.3, 0.3, 0.16), color: i % 2 ? c.cap : PALETTE.white })
      }
      // Display backing: across the top of the opening, or a board hung inside it -
      // between the neon bars (sharing their faces, it flickered against them).
      const t = 0.28
      if (d.screen) panels.push({ matrix: doorBox(d, 0, h - (d.screen + t) / 2, 0, w - t * 2, d.screen - t, 0.5) })
      // (A gate's board and its panel are drawn by GateBoards, which can roll them up.)
      // Glowing inner edge all round the opening, like the original's neon trim.
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

