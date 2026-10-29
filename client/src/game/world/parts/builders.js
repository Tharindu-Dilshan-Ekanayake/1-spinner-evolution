import { BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, Matrix4, Quaternion, RepeatWrapping, SRGBColorSpace, Vector3 } from 'three'
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

/** The six faces of a box: normal axis and sign, and the two axes the face spans. */
const FACES = [
  { n: [1, 0, 0], u: 2, v: 1 },
  { n: [-1, 0, 0], u: 2, v: 1 },
  { n: [0, 1, 0], u: 0, v: 2 },
  { n: [0, -1, 0], u: 0, v: 2 },
  { n: [0, 0, 1], u: 0, v: 1 },
  { n: [0, 0, -1], u: 0, v: 1 },
]

/**
 * Axis-aligned coloured boxes merged into ONE studded geometry (vertex colours, UVs in
 * world units so every stud is the ground's size). Faces nobody can see are left out:
 * every bottom, and any face pointing along a box's `hide` direction ({ x, z } unit).
 * @param {Array<{ x, y, z, w, h, d, color: string, hide?: { x: number, z: number } }>} boxes
 */
export function studdedBlocks(boxes, tile = 3) {
  const pos = []
  const nor = []
  const uvs = []
  const col = []
  const idx = []
  const c = new Color()
  for (const b of boxes) {
    c.set(b.color)
    const half = [b.w / 2, b.h / 2, b.d / 2]
    const centre = [b.x, b.y, b.z]
    for (const f of FACES) {
      if (f.n[1] < 0) continue
      if (b.hide && f.n[0] === b.hide.x && f.n[2] === b.hide.z && f.n[1] === 0) continue
      const axis = f.n.findIndex((v) => v !== 0)
      const base = pos.length / 3
      for (const [su, sv] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        const p = [0, 0, 0]
        p[axis] = centre[axis] + f.n[axis] * half[axis]
        p[f.u] = centre[f.u] + su * half[f.u]
        p[f.v] = centre[f.v] + sv * half[f.v]
        pos.push(p[0], p[1], p[2])
        nor.push(f.n[0], f.n[1], f.n[2])
        uvs.push(p[f.u] / tile, p[f.v] / tile)
        col.push(c.r, c.g, c.b)
      }
      // Wound to face outwards: the (u, v) basis is left- or right-handed by face.
      const cross = [0, 0, 0]
      const eu = [0, 0, 0]
      const ev = [0, 0, 0]
      eu[f.u] = 1
      ev[f.v] = 1
      cross[0] = eu[1] * ev[2] - eu[2] * ev[1]
      cross[1] = eu[2] * ev[0] - eu[0] * ev[2]
      cross[2] = eu[0] * ev[1] - eu[1] * ev[0]
      const ccw = cross[0] * f.n[0] + cross[1] * f.n[1] + cross[2] * f.n[2] > 0
      if (ccw) idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
      else idx.push(base, base + 2, base + 1, base, base + 3, base + 2)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  g.setAttribute('color', new Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
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
    // Neighbours overlap a little; every other block is 1.5 cm taller so their tops
    // never share a plane (which flickers).
    const h = height + (i % 2) * 0.015
    _p.set(cx + Math.cos(a) * radius, y + h / 2, cz + Math.sin(a) * radius)
    _q.setFromAxisAngle(_up, -a + Math.PI / 2)
    _s.set(width, h, depth)
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
    ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#dfe9f2'
    ctx.fill()
  }
  // Square "studs" over everything.
  const cell = size / 32
  ctx.strokeStyle = 'rgba(40, 60, 110, 0.14)'
  ctx.lineWidth = Math.max(1, size / 256)
  for (let y = 0; y < 32; y += 1) {
    for (let x = 0; x < 32; x += 1) {
      ctx.strokeRect(x * cell + cell * 0.22, y * cell + cell * 0.22, cell * 0.56, cell * 0.56)
    }
  }
  // Bright centre target.
  ctx.beginPath()
  ctx.arc(c, c, c / bands, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  arenaTexture = new CanvasTexture(canvas)
  arenaTexture.colorSpace = SRGBColorSpace
  arenaTexture.wrapS = RepeatWrapping
  arenaTexture.wrapT = RepeatWrapping
  arenaTexture.anisotropy = 8
  return arenaTexture
}
