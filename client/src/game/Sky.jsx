import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  IcosahedronGeometry,
  Object3D,
  Triangle,
  Vector3,
} from 'three'

import { useQuality } from '../store/qualityStore'
import { CLOUDS, LIGHTS } from './sceneStyle'

const SKY_RADIUS = 450

/** Radians per second the whole cloud field turns about its centre. */
const CLOUD_DRIFT = 0.004

const skyVertexShader = /* glsl */ `
  varying vec3 vDirection;

  void main() {
    vDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const skyFragmentShader = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform float exponent;

  varying vec3 vDirection;

  void main() {
    float h = normalize(vDirection).y;
    // Below the horizon stays horizon-coloured, matching the fog on distant ground.
    vec3 color = mix(horizonColor, topColor, pow(max(h, 0.0), exponent));
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`

/**
 * Vertical gradient dome. Follows the camera so the horizon always sits at eye level
 * and the dome can never be walked out of.
 */
function SkyDome({ sky }) {
  const ref = useRef(null)
  const camera = useThree((s) => s.camera)

  // A new zone's sky gets a new material (keyed below); the program itself is cached.
  const uniforms = useMemo(
    () => ({
      topColor: { value: new Color(sky.top) },
      horizonColor: { value: new Color(sky.horizon) },
      exponent: { value: sky.exponent },
    }),
    [sky],
  )

  useFrame(() => {
    ref.current?.position.copy(camera.position)
  })

  return (
    <mesh ref={ref} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[SKY_RADIUS, 24, 12]} />
      <shaderMaterial
        key={sky.top + sky.horizon}
        side={BackSide}
        depthWrite={false}
        fog={false}
        uniforms={uniforms}
        vertexShader={skyVertexShader}
        fragmentShader={skyFragmentShader}
      />
    </mesh>
  )
}

/** Small seeded PRNG, so the cloud layout is the same on every load. */
function mulberry32(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A faceted puff with its shading baked into vertex colours: white where a face points
 * up or towards the sun, blue-grey underneath.
 *
 * Baked rather than lit so the clouds stay bright white regardless of the scene lights,
 * and the flat per-face colour gives the low-poly look.
 */
function createPuffGeometry() {
  const geometry = new IcosahedronGeometry(1, 1)
  const position = geometry.getAttribute('position')
  const colors = new Float32Array(position.count * 3)

  const top = new Color(CLOUDS.top)
  const bottom = new Color(CLOUDS.bottom)
  const sun = new Vector3(...LIGHTS.sunDirection).normalize()
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  const faceNormal = new Vector3()
  const faceColor = new Color()

  // IcosahedronGeometry is non-indexed: every 3 vertices are one face.
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i)
    b.fromBufferAttribute(position, i + 1)
    c.fromBufferAttribute(position, i + 2)
    Triangle.getNormal(a, b, c, faceNormal)
    // Every vertex lies on the unit sphere, so the vertex itself points outward.
    if (faceNormal.dot(a) < 0) faceNormal.negate()

    const up = faceNormal.y * 0.5 + 0.5
    const lit = Math.max(faceNormal.dot(sun), 0) * 0.35
    faceColor.copy(bottom).lerp(top, Math.min(1, up * 0.85 + lit))

    for (let v = 0; v < 3; v += 1) {
      colors[(i + v) * 3] = faceColor.r
      colors[(i + v) * 3 + 1] = faceColor.g
      colors[(i + v) * 3 + 2] = faceColor.b
    }
  }

  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  return geometry
}

/**
 * Every puff of every cloud as one instanced mesh (one draw call). Clouds ring the
 * play area, some below the island edge so the world reads as floating in the sky.
 */
function buildPuffs(count) {
  const rand = mulberry32(7)
  const puffs = []
  for (let i = 0; i < count; i += 1) {
    const size = 7 + rand() * 6
    const puffCount = 3 + Math.floor(rand() * 3)
    const angle = rand() * Math.PI * 2
    const dist = 130 + rand() * 120
    const cx = Math.cos(angle) * dist
    const cz = Math.sin(angle) * dist - 60
    const cy = rand() < 0.4 ? -18 - rand() * 14 : 30 + rand() * 18
    const rot = rand() * Math.PI
    for (let p = 0; p < puffCount; p += 1) {
      const along = (p - (puffCount - 1) / 2) * size * 0.9
      const taper = 1 - Math.abs(along) / (size * puffCount * 0.6)
      const s = size * (0.75 + rand() * 0.35) * taper
      puffs.push({
        x: cx + Math.cos(rot) * along,
        y: cy + (rand() - 0.3) * size * 0.4,
        z: cz + Math.sin(rot) * along,
        sx: s,
        sy: s * 0.75,
        sz: s * 0.85,
      })
    }
    puffs.push({ x: cx, y: cy + size * 0.55, z: cz, sx: size * 0.8, sy: size * 0.65, sz: size * 0.7 })
  }
  return puffs
}

function Clouds({ count }) {
  const ref = useRef(null)
  const geometry = useMemo(() => createPuffGeometry(), [])
  const puffs = useMemo(() => buildPuffs(count), [count])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const dummy = new Object3D()
    puffs.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z)
      dummy.scale.set(p.sx, p.sy, p.sz)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [puffs])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame((_state, delta) => {
    if (ref.current) ref.current.rotation.y += delta * CLOUD_DRIFT
  })

  if (!puffs.length) return null
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, puffs.length]} frustumCulled={false}>
      {/* fog off: the clouds sit past the fog's far distance and would vanish. */}
      <meshBasicMaterial vertexColors fog={false} />
    </instancedMesh>
  )
}

/** Night-sky stars as one point cloud on the dome. */
function Stars() {
  const ref = useRef(null)
  const camera = useThree((s) => s.camera)
  const geometry = useMemo(() => {
    const rand = mulberry32(11)
    const n = 600
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i += 1) {
      const u = rand() * 2 - 1
      const t = rand() * Math.PI * 2
      const y = Math.abs(u) * 0.95 + 0.05
      const r = Math.sqrt(1 - y * y)
      pos[i * 3] = Math.cos(t) * r * 400
      pos[i * 3 + 1] = y * 400
      pos[i * 3 + 2] = Math.sin(t) * r * 400
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    return g
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame(() => ref.current?.position.copy(camera.position))
  return (
    <points ref={ref} geometry={geometry} frustumCulled={false} renderOrder={-1}>
      <pointsMaterial color="#ffffff" size={1.6} sizeAttenuation={false} fog={false} depthWrite={false} />
    </points>
  )
}

function Moon() {
  const ref = useRef(null)
  const camera = useThree((s) => s.camera)
  useFrame(() => {
    if (ref.current) ref.current.position.set(camera.position.x - 160, camera.position.y + 170, camera.position.z - 260)
  })
  return (
    <mesh ref={ref} renderOrder={-1}>
      <sphereGeometry args={[22, 16, 12]} />
      <meshBasicMaterial color="#fff4c9" fog={false} />
    </mesh>
  )
}

/** Gradient sky plus whatever the zone's theme adds (clouds, stars, moon). */
export function Sky({ theme }) {
  const q = useQuality()
  return (
    <>
      <SkyDome sky={theme.sky} />
      {theme.clouds && q.clouds > 0 && <Clouds count={q.clouds} />}
      {theme.stars && <Stars />}
      {theme.moon && <Moon />}
    </>
  )
}

export default Sky
