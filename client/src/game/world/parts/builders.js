import { CanvasTexture, Matrix4, Quaternion, RepeatWrapping, SRGBColorSpace, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { quality } from '../../../store/qualityStore'
import { createWorldBoxGeometry } from '../../textures'

/**
 * Geometry helpers for building worlds out of many boxes cheaply.
 */

/**
 * Many axis-aligned boxes merged into ONE geometry (one draw call), each with
 * world-scaled UVs so studs line up across every surface.
 * @param {Array<{ x, y, z, w, h, d }>} boxes  centre + size
 */
export function mergedBoxes(boxes, tile = 3) {
  if (!boxes.length) return null
  const parts = boxes.map((b) => {
    const g = createWorldBoxGeometry(b.w, b.h, b.d, tile)
    g.translate(b.x, b.y, b.z)
    return g
  })
  const merged = mergeGeometries(parts, false)
  for (const p of parts) p.dispose()
  merged.computeBoundingSphere()
  return merged
}

const _m = new Matrix4()
const _q = new Quaternion()
const _p = new Vector3()
const _s = new Vector3()
const _up = new Vector3(0, 1, 0)

/** Matrices for blocks standing in a ring (castle-wall look). */
export function ringBlocks(cx, cz, radius, { height = 1.2, depth = 1, y = 0, step = 1.65 } = {}) {
  const count = Math.max(8, Math.round((Math.PI * 2 * radius) / step))
  const width = ((Math.PI * 2 * radius) / count) * 1.04
  const out = []
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2
    _p.set(cx + Math.cos(a) * radius, y + height / 2, cz + Math.sin(a) * radius)
    _q.setFromAxisAngle(_up, -a + Math.PI / 2)
    _s.set(width, height, depth)
    out.push(_m.compose(_p, _q, _s).clone())
  }
  return out
}

/** A box matrix (centre + size + yaw). */
export function boxMatrix(x, y, z, w, h, d, ry = 0) {
  _p.set(x, y, z)
  _q.setFromAxisAngle(_up, ry)
  _s.set(w, h, d)
  return _m.compose(_p, _q, _s).clone()
}

/** An unrotated, scaled matrix. */
export function scaleMatrix(x, y, z, sx, sy, sz) {
  return new Matrix4().makeScale(sx, sy, sz).setPosition(x, y, z)
}

let arenaTexture = null

/** Concentric rings with a stud grid: the arena dish floor (grayscale, tinted). */
export function getArenaTexture() {
  if (arenaTexture) return arenaTexture
  const size = quality().textureSize
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const c = size / 2
  const bands = 7
  for (let i = bands; i > 0; i -= 1) {
    ctx.beginPath()
    ctx.arc(c, c, (i / bands) * c, 0, Math.PI * 2)
    ctx.fillStyle = i % 2 === 0 ? '#c9cfe0' : '#b4bbd2'
    ctx.fill()
  }
  // Square "studs" over everything.
  const cell = size / 32
  ctx.strokeStyle = 'rgba(40, 50, 90, 0.18)'
  ctx.lineWidth = Math.max(1, size / 256)
  for (let y = 0; y < 32; y += 1) {
    for (let x = 0; x < 32; x += 1) {
      ctx.strokeRect(x * cell + cell * 0.22, y * cell + cell * 0.22, cell * 0.56, cell * 0.56)
    }
  }
  // Bright centre target.
  ctx.beginPath()
  ctx.arc(c, c, c / bands, 0, Math.PI * 2)
  ctx.fillStyle = '#eef1fa'
  ctx.fill()
  arenaTexture = new CanvasTexture(canvas)
  arenaTexture.colorSpace = SRGBColorSpace
  arenaTexture.wrapS = RepeatWrapping
  arenaTexture.wrapT = RepeatWrapping
  arenaTexture.anisotropy = 8
  return arenaTexture
}
