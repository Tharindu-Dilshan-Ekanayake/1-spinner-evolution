import {
  BoxGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  OctahedronGeometry,
  Shape,
  Vector2,
} from 'three'
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
 * carries `aPart`: 0 primary, 1 secondary, 2 metal, 3 accent, 4 dark. The instanced
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
const ACCENT = 3
const DARK = 4

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
    8,
  )
  const collar = lathe(
    [
      [0.19, 0.22],
      [0.28, 0.25],
      [0.31, 0.3],
      [0.29, 0.35],
      [0.2, 0.37],
    ],
    10,
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
      16,
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
 * Small details: tooth caps, rivets, gems
 * ------------------------------------------------------------------------- */

/**
 * World angle of tooth `i` of an `n`-tooth shape. Shapes are drawn in the XY plane and
 * laid flat by slab() (shape y becomes world -z), which mirrors the angle.
 */
const toothAngle = (i, n) => -((i + 0.5) / n) * Math.PI * 2

/** A small box at radius r, angle a, with its length running round the ring. */
function radialBox(a, r, y, w, h, d) {
  const g = new BoxGeometry(w, h, d)
  g.rotateY(Math.PI / 2 - a)
  g.translate(Math.cos(a) * r, y + h / 2, Math.sin(a) * r)
  return g
}

/** Bright caps on the tips of an n-tooth ring. */
function toothCaps(n, r, y, part = ACCENT) {
  return Array.from({ length: n }, (_, i) => tag(radialBox(toothAngle(i, n), r, y, 0.17, 0.035, 0.12), part))
}

/** A ring of metal rivets. */
function rivets(n, r, y, size = 0.07) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return tag(radialBox(a, r, y, size, size * 0.6, size), METAL)
  })
}

/** Faceted gems (octahedra) round a ring, at the given angles. */
function gems(angles, r, y, size, part) {
  return angles.map((a) => {
    const g = new OctahedronGeometry(size, 0)
    g.scale(1, 0.7, 1)
    g.translate(Math.cos(a) * r, y + size * 0.7, Math.sin(a) * r)
    return tag(g, part)
  })
}

/* ---------------------------------------------------------------------------
 * Families
 *
 * Parts: PRIMARY (the spinner's colour), SECONDARY (its second colour), METAL,
 * ACCENT (a light tint of the primary, for highlights) and DARK (a deep shade of the
 * primary, for undersides and outlines). Five tones from the two colours each
 * spinner defines.
 * ------------------------------------------------------------------------- */

const builders = {
  /** Gear ring with bright tooth caps and a riveted inner ring - the classic spinner. */
  disc() {
    const n = 14
    return [
      ...driver(),
      wheel(0.8),
      tag(slab(gearShape(n, 0.78, 1.04, 0.55), 0.06, 0.41, 0), DARK),
      tag(slab(gearShape(n, 0.8, 1.0, 0.55), 0.17, 0.45), PRIMARY),
      ...toothCaps(n, 0.95, 0.62),
      tag(
        lathe(
          [
            [0.34, 0.58],
            [0.66, 0.58],
            [0.72, 0.62],
            [0.68, 0.68],
            [0.36, 0.69],
          ],
          18,
        ),
        SECONDARY,
      ),
      ...rivets(6, 0.53, 0.68),
      ...bolt(0.68),
    ]
  },

  /** Two stacked saw blades (one light, one in colour) over a domed body. */
  saw() {
    const n = 18
    const top = slab(sawShape(n, 0.72, 0.94), 0.06, 0.52, 0)
    top.rotateY(Math.PI / n)
    return [
      ...driver(),
      wheel(0.78),
      tag(slab(sawShape(n, 0.84, 1.08), 0.08, 0.44, 0.02), PRIMARY),
      tag(top, ACCENT),
      tag(
        lathe(
          [
            [0.3, 0.5],
            [0.66, 0.52],
            [0.7, 0.58],
            [0.6, 0.66],
            [0.36, 0.69],
          ],
          20,
        ),
        SECONDARY,
      ),
      ...rivets(5, 0.48, 0.66),
      ...bolt(0.68),
    ]
  },

  /** Three sweeping blades, outlined underneath, with gems at their roots. */
  blade() {
    const parts = [...driver(), wheel(0.72)]
    const shape = bladeShape()
    for (let i = 0; i < 3; i += 1) {
      const turn = (i * Math.PI * 2) / 3
      const under = slab(shape, 0.06, 0.41, 0)
      under.scale(1.06, 1, 1.06)
      under.rotateY(turn)
      const main = slab(shape, 0.15, 0.44)
      main.rotateY(turn)
      const stripe = slab(shape, 0.04, 0.59, 0)
      stripe.scale(0.82, 1, 0.82)
      stripe.rotateY(turn)
      parts.push(tag(under, DARK), tag(main, PRIMARY), tag(stripe, ACCENT))
    }
    const core = slab(starShape(3, 0.36, 0.56), 0.13, 0.52, 0.03)
    parts.push(tag(core, SECONDARY))
    parts.push(...gems([0, 1, 2].map((i) => -Math.PI / 2 - (i * Math.PI * 2) / 3), 0.44, 0.63, 0.09, ACCENT))
    parts.push(...bolt(0.65, 0.26))
    return parts
  },

  /** Saucer: a panelled shell with a bumped rim and a glassy cockpit on top. */
  dome() {
    const cockpit = lathe(
      [
        [0.44, 0.7],
        [0.4, 0.8],
        [0.28, 0.9],
        [0.12, 0.95],
        [0, 0.96],
      ],
      18,
    )
    const cockpitRim = lathe(
      [
        [0.5, 0.68],
        [0.5, 0.72],
        [0.42, 0.74],
      ],
      18,
    )
    return [
      ...driver(),
      wheel(0.7),
      tag(
        lathe(
          [
            [0.86, 0.4],
            [1.03, 0.43],
            [1.03, 0.47],
            [0.9, 0.48],
          ],
          24,
        ),
        DARK,
      ),
      tag(
        lathe(
          [
            [0.3, 0.42],
            [0.9, 0.44],
            [1.0, 0.5],
            [0.96, 0.56],
            [0.72, 0.62],
            [0.5, 0.69],
          ],
          24,
        ),
        PRIMARY,
      ),
      tag(slab(gearShape(8, 0.86, 1.05, 0.32), 0.1, 0.46, 0.025), SECONDARY),
      tag(cockpitRim, METAL),
      tag(cockpit, ACCENT),
    ]
  },

  /** Five-pointed star, outlined, with an inner star and gems on its points. */
  star() {
    const points = Array.from({ length: 5 }, (_, i) => -Math.PI / 2 - (i / 5) * Math.PI * 2)
    return [
      ...driver(),
      wheel(0.62),
      tag(slab(starShape(5, 0.6, 1.11), 0.06, 0.41, 0), DARK),
      tag(slab(starShape(5, 0.56, 1.05), 0.17, 0.44), PRIMARY),
      tag(slab(starShape(5, 0.3, 0.58), 0.08, 0.6, 0), ACCENT),
      ...gems(points, 0.8, 0.6, 0.1, SECONDARY),
      ...bolt(0.66, 0.24),
    ]
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
