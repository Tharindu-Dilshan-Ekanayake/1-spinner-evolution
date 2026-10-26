import {
  AdditiveBlending,
  CanvasTexture,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  NormalBlending,
  PlaneGeometry,
  ShaderMaterial,
  SRGBColorSpace,
  UniformsLib,
  UniformsUtils,
} from 'three'

/**
 * Two immediate-mode quad batches that carry every small effect in the game:
 *
 *   fxBatch     - additive, 2x2 sprite atlas (glow / ring / sparkle / puff). Spinner
 *                 glows, sparks, aura rings, level-up beams, hit flashes.
 *   shadowBatch - normal-blended dark blobs under spinners and NPCs.
 *
 * Quads are either camera-facing billboards or lie flat on the ground. One draw call
 * per batch, whatever the number of effects.
 */

export const SPRITE = { glow: 0, ring: 1, sparkle: 2, puff: 3 }

function makeAtlas() {
  const size = 128
  const cell = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  // 0: soft glow
  let g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, cell, cell)

  // 1: ring
  g = ctx.createRadialGradient(96, 32, 18, 96, 32, 31)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(0.5, 'rgba(255,255,255,1)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(cell, 0, cell, cell)

  // 2: four-point sparkle
  ctx.save()
  ctx.translate(32, 96)
  g = ctx.createRadialGradient(0, 0, 0, 0, 0, 30)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  for (let i = 0; i < 2; i += 1) {
    ctx.rotate(Math.PI / 2)
    ctx.beginPath()
    ctx.moveTo(-30, 0)
    ctx.quadraticCurveTo(0, 4, 30, 0)
    ctx.quadraticCurveTo(0, -4, -30, 0)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(0, 0, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // 3: puff (lumpy soft cloud)
  for (const [x, y, r] of [
    [96, 96, 20],
    [84, 90, 13],
    [108, 92, 12],
    [92, 106, 12],
    [104, 104, 13],
  ]) {
    g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(255,255,255,0.9)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

const vertexShader = /* glsl */ `
  attribute vec4 iPos;
  attribute vec4 iCol;
  attribute vec4 iExt;
  varying vec2 vUv;
  varying vec4 vCol;
  #include <fog_pars_vertex>
  void main() {
    float cell = iExt.x;
    vec2 off = vec2(mod(cell, 2.0) * 0.5, 0.5 - floor(cell / 2.0) * 0.5);
    vUv = off + uv * 0.5;
    vCol = iCol;
    float c = cos(iExt.z);
    float s = sin(iExt.z);
    vec2 q = vec2(c * position.x - s * position.y, s * position.x + c * position.y);
    q.y *= iExt.w;
    vec4 mvPosition;
    if (iExt.y > 0.5) {
      vec3 p = iPos.xyz + vec3(q.x * iPos.w, 0.0, q.y * iPos.w);
      mvPosition = viewMatrix * vec4(p, 1.0);
    } else {
      mvPosition = viewMatrix * vec4(iPos.xyz, 1.0);
      mvPosition.xy += q * iPos.w;
    }
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  varying vec2 vUv;
  varying vec4 vCol;
  #include <fog_pars_fragment>
  void main() {
    float a = texture2D(map, vUv).a * vCol.a;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vCol.rgb, a);
    #include <fog_fragment>
  }
`

class QuadBatch {
  constructor(max, blending, atlas) {
    const base = new PlaneGeometry(1, 1)
    const geo = new InstancedBufferGeometry()
    geo.index = base.index
    geo.setAttribute('position', base.getAttribute('position'))
    geo.setAttribute('uv', base.getAttribute('uv'))
    const attr = (size) => {
      const a = new InstancedBufferAttribute(new Float32Array(max * size), size)
      a.setUsage(DynamicDrawUsage)
      return a
    }
    this.pos = attr(4)
    this.col = attr(4)
    this.ext = attr(4)
    geo.setAttribute('iPos', this.pos)
    geo.setAttribute('iCol', this.col)
    geo.setAttribute('iExt', this.ext)
    geo.instanceCount = 0

    const material = new ShaderMaterial({
      // Fog uniforms must exist: three copies the scene fog into them every frame.
      uniforms: UniformsUtils.merge([UniformsLib.fog, { map: { value: null } }]),
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending,
      fog: true,
    })
    // Set after merge(), which would otherwise clone the texture.
    material.uniforms.map.value = atlas

    this.mesh = new Mesh(geo, material)
    this.mesh.frustumCulled = false
    this.mesh.matrixAutoUpdate = false
    this.geometry = geo
    this.max = max
    this.count = 0
  }

  begin() {
    this.count = 0
  }

  /**
   * @param {number} sprite  SPRITE.* cell
   * @param {boolean} flat   lie on the ground instead of facing the camera
   */
  push(x, y, z, size, r, g, b, a, sprite = 0, flat = false, rotation = 0, stretch = 1) {
    if (this.count >= this.max) return
    const i = this.count * 4
    this.count += 1
    const p = this.pos.array
    const c = this.col.array
    const e = this.ext.array
    p[i] = x
    p[i + 1] = y
    p[i + 2] = z
    p[i + 3] = size
    c[i] = r
    c[i + 1] = g
    c[i + 2] = b
    c[i + 3] = a
    e[i] = sprite
    e[i + 1] = flat ? 1 : 0
    e[i + 2] = rotation
    e[i + 3] = stretch
  }

  end() {
    this.geometry.instanceCount = this.count
    if (!this.count) return
    for (let k = 0; k < 3; k += 1) {
      const attr = k === 0 ? this.pos : k === 1 ? this.col : this.ext
      attr.clearUpdateRanges()
      attr.addUpdateRange(0, this.count * 4)
      attr.needsUpdate = true
    }
  }
}

const atlas = makeAtlas()

export const fxBatch = new QuadBatch(1400, AdditiveBlending, atlas)
export const shadowBatch = new QuadBatch(600, NormalBlending, atlas)
// Blobs render before the additive effects so glows sit on top of them.
shadowBatch.mesh.renderOrder = 1
fxBatch.mesh.renderOrder = 2
