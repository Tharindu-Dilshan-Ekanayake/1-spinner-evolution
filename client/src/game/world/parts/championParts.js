import {
  BoxGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  MeshLambertMaterial,
  NearestFilter,
  SRGBColorSpace,
  SkinnedMesh,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { WORLDS } from '@shared'

/**
 * Stage champions: Bloxity avatars (the same player.glb rig every player uses) in a
 * team jersey, shorts, sneakers and a cap, one per stage, standing on the red pad.
 *
 * The look is painted into a 64x64 skin at runtime, so a champion costs no download
 * beyond the player.glb the game already loads. The six body boxes are merged into
 * one skinned mesh, so a champion is two draw calls (body + cap).
 */

/*
 * Skin layout of player.glb, measured from its UVs: [x, y, w, h] in pixels from the
 * top-left. On every side face the rect's top row is the top of the box, and the
 * left column is the viewer's left when facing that side.
 */
const SKIN = {
  head: { front: [1, 20, 8, 8], back: [1, 4, 8, 8], top: [1, 12, 8, 8], bottom: [1, 28, 8, 8], left: [21, 20, 8, 8], right: [11, 20, 8, 8] },
  torso: { front: [39, 29, 14, 12], back: [17, 29, 14, 12], top: [39, 21, 14, 8], bottom: [39, 41, 14, 8], left: [53, 29, 8, 12], right: [31, 29, 8, 12] },
  armL: { front: [30, 7, 6, 12], back: [17, 7, 6, 12], top: [30, 0, 6, 7], bottom: [30, 19, 6, 7], left: [10, 7, 7, 12], right: [23, 7, 7, 12] },
  armR: { front: [57, 8, 6, 12], back: [44, 8, 6, 12], top: [57, 1, 6, 7], bottom: [57, 20, 6, 7], left: [37, 8, 7, 12], right: [50, 8, 7, 12] },
  legL: { front: [3, 38, 7, 12], back: [15, 51, 7, 12], top: [21, 42, 7, 8], bottom: [12, 42, 7, 8], left: [7, 51, 8, 12], right: [22, 51, 8, 12] },
  legR: { front: [55, 51, 7, 12], back: [40, 51, 7, 12], top: [55, 43, 7, 8], bottom: [30, 42, 7, 8], left: [32, 51, 8, 12], right: [47, 51, 8, 12] },
}
const SIDES = ['front', 'back', 'left', 'right']

/** Team kits per world; the last stage of a world is its gold-capped champion. */
const KITS = {
  grassland: [
    { jersey: '#e8202a', trim: '#ffffff', shorts: '#1d2a5a', shoes: '#ffffff' },
    { jersey: '#1e6bff', trim: '#ffd400', shorts: '#ffffff', shoes: '#1e6bff' },
    { jersey: '#21a84a', trim: '#ffffff', shorts: '#14331f', shoes: '#ffffff' },
    { jersey: '#ff8a00', trim: '#1a1a1a', shorts: '#1a1a1a', shoes: '#ff8a00' },
    { jersey: '#8a2be2', trim: '#ffd400', shorts: '#2a1450', shoes: '#ffffff' },
  ],
  lava: [
    { jersey: '#ff5a00', trim: '#2a0d00', shorts: '#2a0d00', shoes: '#ffb000' },
    { jersey: '#c4141a', trim: '#ffb000', shorts: '#1a0500', shoes: '#ffffff' },
    { jersey: '#1a1a1a', trim: '#ff5a00', shorts: '#3a1000', shoes: '#ff5a00' },
  ],
  galaxy: [
    { jersey: '#6a00ff', trim: '#00e5ff', shorts: '#160033', shoes: '#00e5ff' },
    { jersey: '#0b1a4a', trim: '#ff4df0', shorts: '#0b0b20', shoes: '#ffffff' },
    { jersey: '#00b8d4', trim: '#ffffff', shorts: '#14004a', shoes: '#ff4df0' },
  ],
}
const SKIN_TONES = ['#ffd2a6', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac']
const HAIR = ['#2b1a0e', '#111111', '#6b3e1f', '#d9a441', '#a33a12']
const NAMES = ['Ace', 'Blaze', 'Rex', 'Nova', 'Spike', 'Zed', 'Max', 'Kai', 'Volt', 'Jax', 'Luna', 'Rio', 'Dash', 'Storm']
const GOLD = '#ffd400'

/** Everything that makes one stage's champion look different from the next. */
export function championLook(worldId, k) {
  const world = WORLDS[worldId] || WORLDS.grassland
  const global = world.event ? k : world.firstStage + k - 1
  const kits = KITS[worldId] || KITS.grassland
  const kit = kits[(k - 1) % kits.length]
  const final = k === world.stageCount
  return {
    key: `${worldId}:${k}`,
    number: global,
    final,
    name: final ? `Champion ${NAMES[(global * 5) % NAMES.length]}` : `Coach ${NAMES[(global * 5) % NAMES.length]}`,
    title: final ? 'WORLD CHAMPION' : `Stage ${global}`,
    skin: SKIN_TONES[(global * 7) % SKIN_TONES.length],
    hair: HAIR[(global * 3) % HAIR.length],
    ...kit,
    cap: final ? GOLD : kit.jersey,
    brim: final ? '#1a1a1a' : kit.trim,
    badge: final ? kit.jersey : GOLD,
  }
}

/* ---------------------------------------------------------------------------
 * Skin painting
 * ------------------------------------------------------------------------- */

// 3x5 pixel digits for the shirt number.
const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111']

function shade(hex, f) {
  const c = new Color(hex)
  return `#${c.multiplyScalar(f).getHexString()}`
}

function painter(ctx) {
  const fill = ([x, y, w, h], color) => {
    ctx.fillStyle = color
    ctx.fillRect(x, y, w, h)
  }
  // A pixel at (col, row) inside a face rect.
  const dot = ([x, y], col, row, color, w = 1, h = 1) => {
    ctx.fillStyle = color
    ctx.fillRect(x + col, y + row, w, h)
  }
  return { fill, dot }
}

function paintHead(p, look) {
  const h = SKIN.head
  for (const side of [...SIDES, 'bottom']) p.fill(h[side], look.skin)
  p.fill(h.top, look.hair)
  // Back of the head: hair down to the neck.
  p.dot(h.back, 0, 0, look.hair, 8, 6)
  // Sides: hair on top and at the back, sideburn in front of the ear.
  for (const [rect, backCol] of [
    [h.left, 4],
    [h.right, 0],
  ]) {
    p.dot(rect, 0, 0, look.hair, 8, 3)
    p.dot(rect, backCol, 3, look.hair, 4, 3)
    p.dot(rect, backCol === 4 ? 1 : 6, 3, look.hair, 1, 2)
    p.dot(rect, 3, 4, shade(look.skin, 0.85), 2, 2)
  }
  // Face: fringe, determined brows, eyes looking in, nose, a grin.
  const f = h.front
  p.dot(f, 0, 0, look.hair, 8, 2)
  p.dot(f, 0, 2, look.hair, 1, 2)
  p.dot(f, 7, 2, look.hair, 1, 2)
  p.dot(f, 1, 3, shade(look.hair, 0.8), 2, 1)
  p.dot(f, 5, 3, shade(look.hair, 0.8), 2, 1)
  p.dot(f, 1, 4, '#ffffff')
  p.dot(f, 2, 4, '#1a2340')
  p.dot(f, 5, 4, '#1a2340')
  p.dot(f, 6, 4, '#ffffff')
  p.dot(f, 3, 5, shade(look.skin, 0.82), 2, 1)
  p.dot(f, 2, 6, '#5a1a1a', 4, 1)
  p.dot(f, 3, 6, '#ffffff', 2, 1)
  p.dot(f, 2, 5, '#5a1a1a')
  p.dot(f, 5, 5, '#5a1a1a')
}

function paintNumber(p, rect, n, color, scale, top) {
  const text = String(n)
  const w = text.length * 3 * scale + (text.length - 1) * scale
  let col = Math.floor((rect[2] - w) / 2)
  for (const ch of text) {
    const bits = DIGITS[Number(ch)] || DIGITS[0]
    for (let i = 0; i < 15; i += 1) {
      if (bits[i] === '1') p.dot(rect, col + (i % 3) * scale, top + Math.floor(i / 3) * scale, color, scale, scale)
    }
    col += 4 * scale
  }
}

function paintTorso(p, look) {
  const t = SKIN.torso
  const dark = shade(look.jersey, 0.72)
  for (const side of [...SIDES, 'top']) p.fill(t[side], look.jersey)
  p.fill(t.bottom, look.shorts)
  p.dot(t.top, 4, 2, look.skin, 6, 4)
  // Front: V-neck in the trim colour, a crown badge, a trimmed hem.
  const f = t.front
  p.dot(f, 4, 0, look.trim)
  p.dot(f, 9, 0, look.trim)
  p.dot(f, 5, 0, look.skin, 4, 1)
  p.dot(f, 5, 1, look.trim)
  p.dot(f, 8, 1, look.trim)
  p.dot(f, 6, 1, look.skin, 2, 1)
  p.dot(f, 6, 2, look.trim, 2, 1)
  const crown = ['1.11.1', '111111', '1r11r1', '111111']
  crown.forEach((row, r) => {
    for (let c = 0; c < 6; c += 1) {
      if (row[c] === '1') p.dot(f, 4 + c, 4 + r, look.final ? '#ffffff' : GOLD)
      else if (row[c] === 'r') p.dot(f, 4 + c, 4 + r, '#e8202a')
    }
  })
  p.dot(f, 0, 10, look.trim, 14, 1)
  p.dot(f, 0, 11, dark, 14, 1)
  // Back: the stage number, big, like a real jersey.
  const b = t.back
  p.dot(b, 0, 11, dark, 14, 1)
  paintNumber(p, b, look.number, look.trim, 2, 1)
  // Sides: a racing stripe.
  for (const rect of [t.left, t.right]) {
    p.dot(rect, 3, 0, look.trim, 2, 11)
    p.dot(rect, 0, 11, dark, 8, 1)
  }
}

function paintArm(p, a, look) {
  for (const side of SIDES) {
    const r = a[side]
    p.fill(r, look.skin)
    p.dot(r, 0, 0, look.jersey, r[2], 4)
    p.dot(r, 0, 4, look.trim, r[2], 1)
    // Wristband.
    p.dot(r, 0, 9, look.final ? GOLD : look.trim, r[2], 1)
  }
  p.fill(a.top, look.jersey)
  p.fill(a.bottom, look.skin)
}

function paintLeg(p, l, look, outer) {
  for (const side of SIDES) {
    const r = l[side]
    p.fill(r, look.skin)
    p.dot(r, 0, 0, look.shorts, r[2], 5)
    p.dot(r, 0, 8, '#ffffff', r[2], 2)
    p.dot(r, 0, 8, look.jersey, r[2], 1)
    p.dot(r, 0, 10, look.shoes, r[2], 2)
  }
  // Stripe down the outside of the shorts, toe caps on the shoes.
  p.dot(l[outer], 3, 0, look.trim, 2, 5)
  p.dot(l.front, 0, 11, '#ffffff', l.front[2], 1)
  p.fill(l.top, look.shorts)
  p.fill(l.bottom, '#222222')
}

/** Paints a champion's 64x64 skin. The caller owns (and disposes) the texture. */
export function championTexture(look) {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  const p = painter(ctx)
  paintHead(p, look)
  paintTorso(p, look)
  paintArm(p, SKIN.armL, look)
  paintArm(p, SKIN.armR, look)
  // The left leg's outside faces +X (its "left" rect); the right leg's faces -X.
  paintLeg(p, SKIN.legL, look, 'left')
  paintLeg(p, SKIN.legR, look, 'right')
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.flipY = false
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.generateMipmaps = false
  return texture
}

/* ---------------------------------------------------------------------------
 * Cap (built in the rig's own units: the head box spans x/z +-0.8, y 4.8-6.4)
 * ------------------------------------------------------------------------- */

function box(w, h, d, x, y, z, hex) {
  const g = new BoxGeometry(w, h, d)
  g.translate(x, y, z)
  const c = new Color(hex)
  const n = g.getAttribute('position').count
  const colors = new Float32Array(n * 3)
  for (let i = 0; i < n; i += 1) colors.set([c.r, c.g, c.b], i * 3)
  g.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return g
}

/** A baseball cap with a stepped crown, a long brim, a badge and a button. */
export function capGeometry(look) {
  const parts = [
    box(1.76, 0.62, 1.76, 0, 6.32, 0, look.cap),
    box(1.52, 0.16, 1.52, 0, 6.71, 0, look.cap),
    box(1.0, 0.1, 1.0, 0, 6.82, 0, shade(look.cap, 0.92)),
    box(0.26, 0.12, 0.26, 0, 6.92, 0, look.brim),
    box(1.7, 0.1, 0.9, 0, 6.06, 1.28, look.brim),
    box(0.78, 0.4, 0.06, 0, 6.38, 0.9, look.badge),
    box(0.36, 0.18, 0.08, 0, 6.38, 0.92, look.cap),
  ]
  const g = mergeGeometries(parts)
  for (const part of parts) part.dispose()
  return g
}

let capMaterial = null
export function getCapMaterial() {
  if (!capMaterial) capMaterial = new MeshLambertMaterial({ vertexColors: true })
  return capMaterial
}

/* ---------------------------------------------------------------------------
 * One draw call for the body
 * ------------------------------------------------------------------------- */

function attributeKey(g) {
  return Object.keys(g.attributes)
    .sort()
    .map((name) => `${name}:${g.attributes[name].itemSize}:${g.attributes[name].array.constructor.name}`)
    .join('|')
}

/**
 * Replaces the rig's six skinned boxes with one skinned mesh using `material`.
 * player.glb's parts share one skeleton, sit at the identity and have the same
 * attributes; if a future rig breaks that, the parts are kept and just re-skinned.
 *
 * @returns {import('three').BufferGeometry|null} the merged geometry (caller disposes)
 */
export function mergeBody(rig, material) {
  const meshes = rig.skinnedMeshes
  const first = meshes[0]
  const key = first && attributeKey(first.geometry)
  const mergeable =
    first &&
    meshes.every(
      (m) =>
        m.parent === first.parent &&
        m.skeleton === first.skeleton &&
        m.bindMatrix.equals(first.bindMatrix) &&
        m.matrix.equals(first.matrix) &&
        !!m.geometry.index === !!first.geometry.index &&
        attributeKey(m.geometry) === key,
    )
  const merged = mergeable ? mergeGeometries(meshes.map((m) => m.geometry)) : null
  if (!merged) {
    for (const m of meshes) m.material = material
    return null
  }
  const body = new SkinnedMesh(merged, material)
  body.name = 'champion_body'
  body.position.copy(first.position)
  body.quaternion.copy(first.quaternion)
  body.scale.copy(first.scale)
  first.parent.add(body)
  body.bind(first.skeleton, first.bindMatrix)
  for (const m of meshes) m.parent.remove(m)
  return merged
}
