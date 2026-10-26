import { CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, LatheGeometry, Shape, Vector2 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Procedural spinner models - no GLB downloads.
 *
 * Every spinner is built like a real battling top, bottom to top:
 *   driver      - a pointed metal tip with a coloured collar (it stands on the point)
 *   wheel       - a heavy metal disc
 *   attack ring - the family's silhouette, in the primary colour
 *   bolt        - a metal-rimmed centre cap with an emblem in the secondary colour
 *
 * Built at radius ~1 with the tip at y = 0, then scaled per instance. Each vertex
 * carries `aPart`: 0 = primary colour, 1 = secondary colour, 2 = metal. The instanced
 * material (spinnerBatch.js) tints and shades by part, so one geometry draws every
 * colour variant of its family in a single draw call.
 *
 * ~700-900 triangles each: a lobby full of players with full teams is a lot of tops,
 * and anything further than a few metres away switches to the LOD puck.
 */

export const FAMILIES = ['disc', 'saw', 'blade', 'dome', 'star']

const PRIMARY = 0
const SECONDARY = 1
const METAL = 2

/** Converts to non-indexed, drops UVs, stamps the part id. */
function tag(geometry, part) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry
  g.deleteAttribute('uv')
  const count = g.getAttribute('position').count
  g.setAttribute('aPart', new Float32BufferAttribute(new Float32Array(count).fill(part), 1))
  return g
}

function lathe(points, segments = 24) {
  return new LatheGeometry(
    points.map(([x, y]) => new Vector2(x, y)),
    segments,
  )
}

/** Flat shape -> bevelled slab from y0 to y0 + depth (bevel included). */
function slab(shape, depth, y0, bevel = 0.03) {
  const g = new ExtrudeGeometry(shape, {
    depth: Math.max(0.01, depth - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 4,
  })
  g.rotateX(-Math.PI / 2)
  g.translate(0, y0 + bevel, 0)
  return g
}

function polarShape(points) {
  const s = new Shape()
  points.forEach(([r, a], i) => {
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) s.moveTo(x, y)
    else s.lineTo(x, y)
  })
  s.closePath()
  return s
}

/** Chunky gear: `n` flat-topped teeth between rIn and rOut. */
function gearShape(n, rIn, rOut, top = 0.5) {
  const pts = []
  const step = (Math.PI * 2) / n
  for (let i = 0; i < n; i += 1) {
    const a = i * step
    pts.push([rIn, a], [rOut, a + step * (0.5 - top / 2)], [rOut, a + step * (0.5 + top / 2)])
  }
  return polarShape(pts)
}

/** Saw blade: `n` hooked teeth. */
function sawShape(n, rIn, rOut) {
  const pts = []
  const step = (Math.PI * 2) / n
  for (let i = 0; i < n; i += 1) {
    const a = i * step
    pts.push([rIn, a], [rOut, a + step * 0.78], [rOut * 0.97, a + step * 0.9])
  }
  return polarShape(pts)
}

function starShape(points, rIn, rOut) {
  const pts = []
  for (let i = 0; i < points * 2; i += 1) {
    pts.push([i % 2 === 0 ? rOut : rIn, (i / (points * 2)) * Math.PI * 2 + Math.PI / 2])
  }
  return polarShape(pts)
}

/** One sweeping blade: a crescent ~110 degrees long, wide at the tip. */
function bladeShape() {
  const pts = []
  const n = 7
  for (let i = 0; i <= n; i += 1) {
    const t = i / n
    pts.push([0.42 + t * 0.66, t * 1.9])
  }
  for (let i = n; i >= 0; i -= 1) {
    const t = i / n
    pts.push([0.38 + t * 0.5, t * 1.9 - 0.5 * (1 - t * 0.55)])
  }
  return polarShape(pts)
}

/* ---------------------------------------------------------------------------
 * Shared layers
 * ------------------------------------------------------------------------- */

/** Pointed metal tip with a coloured collar: the part that touches the floor. */
function driver() {
  const tip = lathe(
    [
      [0, 0],
      [0.04, 0.015],
      [0.1, 0.09],
      [0.16, 0.19],
      [0.19, 0.23],
    ],
    10,
  )
  const collar = lathe(
    [
      [0.19, 0.22],
      [0.28, 0.25],
      [0.31, 0.3],
      [0.29, 0.35],
      [0.2, 0.37],
    ],
    12,
  )
  return [tag(tip, METAL), tag(collar, SECONDARY)]
}

/** The heavy metal disc under the attack ring. */
function wheel(r = 0.82) {
  return tag(
    lathe(
      [
        [0.2, 0.35],
        [r - 0.06, 0.35],
        [r, 0.38],
        [r + 0.02, 0.42],
        [r - 0.04, 0.46],
        [0.3, 0.47],
      ],
      20,
    ),
    METAL,
  )
}

/** Centre bolt: a metal rim round a domed emblem in the secondary colour. */
function bolt(y, r = 0.3) {
  const rim = lathe(
    [
      [r, y],
      [r + 0.03, y + 0.06],
      [r - 0.02, y + 0.11],
      [r - 0.08, y + 0.12],
    ],
    14,
  )
  const face = lathe(
    [
      [r - 0.08, y + 0.11],
      [r * 0.55, y + 0.15],
      [0, y + 0.17],
    ],
    14,
  )
  return [tag(rim, METAL), tag(face, SECONDARY)]
}

/* ---------------------------------------------------------------------------
 * Families
 * ------------------------------------------------------------------------- */

const builders = {
  /** Gear ring with a raised inner ring - the classic "Basic Spinner". */
  disc() {
    const ring = slab(gearShape(14, 0.8, 1.0, 0.55), 0.17, 0.44)
    const inner = lathe(
      [
        [0.34, 0.58],
        [0.66, 0.58],
        [0.72, 0.62],
        [0.68, 0.67],
        [0.36, 0.68],
      ],
      18,
    )
    return [...driver(), wheel(0.8), tag(ring, PRIMARY), tag(inner, SECONDARY), ...bolt(0.66)]
  },

  /** Wide, thin saw blade over a domed body. */
  saw() {
    const blade = slab(sawShape(18, 0.84, 1.08), 0.09, 0.45, 0.02)
    const body = lathe(
      [
        [0.3, 0.44],
        [0.8, 0.46],
        [0.84, 0.52],
        [0.74, 0.6],
        [0.4, 0.64],
      ],
      20,
    )
    return [...driver(), wheel(0.78), tag(blade, PRIMARY), tag(body, SECONDARY), ...bolt(0.62)]
  },

  /** Three sweeping blades round a triangular core. */
  blade() {
    const parts = [...driver(), wheel(0.72)]
    const shape = bladeShape()
    for (let i = 0; i < 3; i += 1) {
      const b = slab(shape, 0.15, 0.44)
      b.rotateY((i * Math.PI * 2) / 3)
      parts.push(tag(b, PRIMARY))
    }
    const core = slab(starShape(3, 0.36, 0.56), 0.13, 0.52, 0.03)
    parts.push(tag(core, SECONDARY), ...bolt(0.64, 0.26))
    return parts
  },

  /** Saucer: a smooth domed shell with a bumped rim. */
  dome() {
    const shell = lathe(
      [
        [0.3, 0.42],
        [0.9, 0.44],
        [1.0, 0.5],
        [0.96, 0.56],
        [0.72, 0.62],
        [0.5, 0.7],
        [0.34, 0.72],
      ],
      24,
    )
    const bumps = slab(gearShape(8, 0.86, 1.04, 0.32), 0.1, 0.46, 0.025)
    return [...driver(), wheel(0.7), tag(shell, PRIMARY), tag(bumps, SECONDARY), ...bolt(0.7, 0.32)]
  },

  /** Five-pointed star with an inner star. */
  star() {
    const star = slab(starShape(5, 0.56, 1.05), 0.17, 0.43)
    const inner = slab(starShape(5, 0.3, 0.58), 0.08, 0.58, 0.02)
    return [...driver(), wheel(0.62), tag(star, PRIMARY), tag(inner, SECONDARY), ...bolt(0.64, 0.24)]
  },
}

const cache = new Map()

/** Shared geometry per family (built once, never disposed - reused all session). */
export function familyGeometry(family) {
  if (!cache.has(family)) {
    const build = builders[family] || builders.disc
    const merged = mergeGeometries(build(), false)
    merged.computeBoundingSphere()
    cache.set(family, merged)
  }
  return cache.get(family)
}

/** Far-away stand-in: a two-tone puck on a tip (~70 triangles). */
export function lodGeometry() {
  if (!cache.has('lod')) {
    const tip = new CylinderGeometry(0.2, 0.02, 0.36, 8, 1)
    tip.translate(0, 0.18, 0)
    const body = new CylinderGeometry(0.95, 0.85, 0.3, 12, 1, true)
    body.translate(0, 0.5, 0)
    const top = new CylinderGeometry(0.95, 0.95, 0.02, 12)
    top.translate(0, 0.65, 0)
    const merged = mergeGeometries([tag(tip, METAL), tag(body, PRIMARY), tag(top, SECONDARY)], false)
    merged.computeBoundingSphere()
    cache.set('lod', merged)
  }
  return cache.get('lod')
}
