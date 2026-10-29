import {
  Color,
  DynamicDrawUsage,
  Euler,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three'

import { SPINNERS, WORLDS } from '@shared'

import { FAMILIES, familyGeometry, lodGeometry } from './spinnerGeometry'

/**
 * Immediate-mode instanced renderer for every spinner in the game.
 *
 * Each frame: begin() -> any system push()es the spinners it wants drawn -> end()
 * uploads. Pets, battle units, training dummies and shop displays all go through
 * here, so the whole lobby's spinners cost one draw call per family (+1 for LODs).
 *
 * Per-instance data: matrix, primary colour, secondary colour, and fx
 * (x = glow, y = hit flash, z = golden, w = unused).
 *
 * Only the cheap LOD puck is built at load. Each family's mesh is built the first time
 * one is drawn, at most one per frame (until then those spinners draw as the puck):
 * building all five up front cost about a third of a second of startup on a phone.
 */

const MAX_PER_FAMILY = 220
const MAX_LOD = 400

/**
 * Glossy plastic for the coloured parts, polished metal for the tip, wheel, rivets and
 * bolt. Five tones come from each spinner's two colours (see spinnerGeometry parts),
 * and the attack ring's top face gets a panel pattern and a pin-stripe, so even a
 * plain one-colour spinner has detail.
 *
 * A fake studio reflection (sky, floor, a strip light) makes the plastic glossy and the
 * metal read as chrome, and a rim light outlines every spinner against the floor. (No
 * real environment map: baking one and recompiling for it froze the game for over a
 * second after load; this costs a few instructions and works on every preset.)
 */
const material = new MeshStandardMaterial({ roughness: 0.3, metalness: 0.12 })
material.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
      attribute float aPart;
      attribute vec3 iColA;
      attribute vec3 iColB;
      attribute vec4 iFx;
      varying vec3 vTint;
      varying vec4 vFx;
      varying float vMetal;
      varying float vPrimary;
      varying vec3 vLocal;`,
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vMetal = (aPart > 1.5 && aPart < 2.5) ? 1.0 : 0.0;
      vPrimary = aPart < 0.5 ? 1.0 : 0.0;
      vTint = aPart < 0.5 ? iColA
        : aPart < 1.5 ? iColB
        : aPart < 2.5 ? vec3(0.86, 0.88, 0.95)
        : aPart < 3.5 ? mix(iColA, vec3(1.0), 0.5)
        : iColA * 0.32;
      // Model-space position and up-ness, for the panel pattern on top faces.
      vLocal = vec3(position.xz, objectNormal.y);
      vFx = iFx;`,
    )
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
      varying vec3 vTint;
      varying vec4 vFx;
      varying float vMetal;
      varying float vPrimary;
      varying vec3 vLocal;`,
    )
    .replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, 0.16, vMetal);`,
    )
    .replace(
      '#include <metalnessmap_fragment>',
      `#include <metalnessmap_fragment>
      metalnessFactor = mix(metalnessFactor, 0.6, vMetal);`,
    )
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      vec3 tint = vTint;
      if (vPrimary > 0.5 && vLocal.z > 0.6) {
        // Six light panels round the top, and a dark pin-stripe ring.
        float sector = step(0.5, fract(atan(vLocal.y, vLocal.x) * 0.9549));
        float r = length(vLocal.xy);
        float stripe = 1.0 - smoothstep(0.012, 0.03, abs(r - 0.87));
        tint = mix(tint, tint * 1.25 + 0.05, sector * 0.5);
        tint = mix(tint, tint * 0.35, stripe);
      }
      float lum = dot(tint, vec3(0.299, 0.587, 0.114));
      tint = mix(tint, vec3(1.0, 0.7, 0.12) * (0.6 + lum), vFx.z * 0.72);
      diffuseColor.rgb *= tint;`,
    )
    .replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      totalEmissiveRadiance += vTint * vFx.x * 0.5 + vec3(vFx.y) + vec3(1.0, 0.75, 0.25) * vFx.z * 0.15;
      // A fake studio around the spinner, reflected: sky above, warm floor below and a
      // bright strip light overhead. No texture, so it costs nothing on any preset.
      vec3 viewDir = normalize(vViewPosition);
      float facing = clamp(dot(normal, viewDir), 0.0, 1.0);
      float fres = pow(1.0 - facing, 2.0);
      vec3 refl = reflect(-viewDir, normal);
      float up = dot(refl, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz));
      vec3 studio = mix(vec3(0.42, 0.34, 0.27), vec3(0.78, 0.9, 1.0), smoothstep(-0.25, 0.35, up));
      studio += vec3(1.0) * smoothstep(0.86, 0.97, up);
      totalEmissiveRadiance += studio * mix(0.05 + 0.2 * fres, 0.3 + 0.4 * fres, vMetal);
      // Rim light: outlines every spinner against the floor.
      float rim = pow(1.0 - facing, 3.0);
      totalEmissiveRadiance += (vMetal > 0.5 ? vec3(0.35) : vTint * 0.3 + 0.06) * rim;`,
    )
}

function makeMesh(geometry, max) {
  const geo = geometry.clone()
  const attr = (size) => {
    const a = new InstancedBufferAttribute(new Float32Array(max * size), size)
    a.setUsage(DynamicDrawUsage)
    return a
  }
  geo.setAttribute('iColA', attr(3))
  geo.setAttribute('iColB', attr(3))
  geo.setAttribute('iFx', attr(4))
  const mesh = new InstancedMesh(geo, material, max)
  mesh.instanceMatrix.setUsage(DynamicDrawUsage)
  mesh.count = 0
  // Instances are spread over the whole map; per-instance culling isn't available,
  // and the mesh-level bounding sphere would be wrong. LOD handles far ones.
  mesh.frustumCulled = false
  mesh.matrixAutoUpdate = false
  return { mesh, max, count: 0, colA: geo.attributes.iColA, colB: geo.attributes.iColB, fx: geo.attributes.iFx }
}

const batches = { lod: makeMesh(lodGeometry(), MAX_LOD) }
const batchList = [batches.lod]
/** Every batch mesh lives here; family meshes join it as they are built. */
const group = new Group()
group.add(batches.lod.mesh)
const KNOWN = new Set(FAMILIES)
let builtThisFrame = false

function batchFor(family) {
  const key = KNOWN.has(family) ? family : 'disc'
  let b = batches[key]
  if (b) return b
  if (builtThisFrame) return batches.lod
  builtThisFrame = true
  b = makeMesh(familyGeometry(key), MAX_PER_FAMILY)
  batches[key] = b
  batchList.push(b)
  group.add(b.mesh)
  return b
}

const _m = new Matrix4()
const _p = new Vector3()
const _q = new Quaternion()
const _s = new Vector3()
const _e = new Euler()
const _cam = new Vector3()
let _lod2 = 42 * 42

/* ---------------------------------------------------------------------------
 * Colour palettes (created once per spinner type, then reused every frame)
 * ------------------------------------------------------------------------- */

const paletteCache = new Map()

function palette(key, a, b) {
  let p = paletteCache.get(key)
  if (!p) {
    p = { a: new Color(a), b: new Color(b) }
    paletteCache.set(key, p)
  }
  return p
}

export function spinnerPalette(id) {
  const def = SPINNERS[id] || SPINNERS.basic
  return palette(id, def.a, def.b)
}

export function enemyPalette(worldId, boss) {
  const w = WORLDS[worldId] || WORLDS.grassland
  return boss ? palette(`boss:${worldId}`, w.enemy.boss, w.enemy.b) : palette(`enemy:${worldId}`, w.enemy.a, w.enemy.b)
}

export function customPalette(key, a, b) {
  return palette(key, a, b)
}

/* ---------------------------------------------------------------------------
 * Frame API
 * ------------------------------------------------------------------------- */

export const spinnerBatch = {
  /** Add this to the scene once; it holds every batch mesh. */
  group,

  /** @param lodDistance  beyond this, spinners draw as the cheap puck */
  begin(camera, lodDistance = 42) {
    _cam.copy(camera.position)
    _lod2 = lodDistance * lodDistance
    builtThisFrame = false
    for (let i = 0; i < batchList.length; i += 1) batchList[i].count = 0
  },

  /**
   * @param {string} family  FAMILIES entry
   * @param {number} angle   spin around Y (radians)
   * @param {number} tilt    wobble tilt (radians), applied around the X axis then Y-rotated
   * @param {{a: Color, b: Color}} pal
   */
  push(family, x, y, z, angle, tilt, tiltDir, scale, pal, glow = 0, flash = 0, golden = false) {
    const dx = x - _cam.x
    const dz = z - _cam.z
    const far = dx * dx + dz * dz > _lod2
    const b = far ? batches.lod : batchFor(family)
    if (b.count >= b.max) return
    const i = b.count
    b.count += 1

    _p.set(x, y, z)
    _e.set(Math.cos(tiltDir) * tilt, angle, Math.sin(tiltDir) * tilt, 'XYZ')
    _q.setFromEuler(_e)
    _s.set(scale, scale, scale)
    _m.compose(_p, _q, _s)
    b.mesh.setMatrixAt(i, _m)

    const a = b.colA.array
    const c = b.colB.array
    const f = b.fx.array
    a[i * 3] = pal.a.r
    a[i * 3 + 1] = pal.a.g
    a[i * 3 + 2] = pal.a.b
    c[i * 3] = pal.b.r
    c[i * 3 + 1] = pal.b.g
    c[i * 3 + 2] = pal.b.b
    f[i * 4] = glow
    f[i * 4 + 1] = flash
    f[i * 4 + 2] = golden ? 1 : 0
    f[i * 4 + 3] = 0
  },

  end() {
    for (let i = 0; i < batchList.length; i += 1) {
      const b = batchList[i]
      b.mesh.count = b.count
      if (!b.count) continue
      b.mesh.instanceMatrix.clearUpdateRanges()
      b.mesh.instanceMatrix.addUpdateRange(0, b.count * 16)
      b.mesh.instanceMatrix.needsUpdate = true
      b.colA.clearUpdateRanges()
      b.colA.addUpdateRange(0, b.count * 3)
      b.colA.needsUpdate = true
      b.colB.clearUpdateRanges()
      b.colB.addUpdateRange(0, b.count * 3)
      b.colB.needsUpdate = true
      b.fx.clearUpdateRanges()
      b.fx.addUpdateRange(0, b.count * 4)
      b.fx.needsUpdate = true
    }
  },
}

export { material as spinnerMaterial }
