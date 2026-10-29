import { PALETTE } from '../../sceneStyle'
import { boxMatrix } from './builders'

/**
 * Box-decor recipes: each returns { matrix, color } blocks for DecorBlocks.
 */

/** Voxel tree: trunk + three canopy blocks. `leaves` is one colour or a shade per block. */
export function treeBlocks(x, z, s = 1, leaves = PALETTE.leaves, trunk = PALETTE.trunk) {
  const shade = (i) => (Array.isArray(leaves) ? leaves[i % leaves.length] : leaves)
  // The smaller leaf blocks stick 20 cm out of the big one: a face exactly level with
  // the big block's (a different shade) would flicker against it.
  return [
    { matrix: boxMatrix(x, 2 * s, z, 1.1 * s, 4 * s, 1.1 * s), color: trunk },
    { matrix: boxMatrix(x, 4.6 * s, z, 4.4 * s, 2.6 * s, 4.4 * s), color: shade(0) },
    { matrix: boxMatrix(x + 0.8 * s, 6.2 * s, z - 0.4 * s, 3.2 * s, 1.8 * s, 3.2 * s), color: shade(1) },
    { matrix: boxMatrix(x - 1.4 * s, 5.4 * s, z + 1.3 * s, 2.2 * s, 1.6 * s, 2.2 * s), color: shade(2) },
  ]
}

export function flowerBlocks(x, z, color = PALETTE.flowers[0]) {
  return [
    { matrix: boxMatrix(x, 0.35, z, 0.12, 0.7, 0.12), color: PALETTE.stem },
    { matrix: boxMatrix(x, 0.78, z, 0.45, 0.22, 0.45), color },
    { matrix: boxMatrix(x, 0.82, z, 0.18, 0.24, 0.18), color: '#ffe14d' },
  ]
}

export function logBlocks(x, z, ry = 0) {
  return [{ matrix: boxMatrix(x, 0.35, z, 3.2, 0.7, 0.8, ry), color: PALETTE.wood }]
}

export function crateBlocks(x, z, s = 1, color = PALETTE.hedge) {
  return [{ matrix: boxMatrix(x, 0.5 * s, z, s, s, s), color }]
}

/** The arch colours: navy plinth, white trim and bands, blue shaft, gold cap. */
const ARCH_COLORS = { base: PALETTE.navy, band: PALETTE.white, body: PALETTE.blue, cap: PALETTE.gold }

/**
 * A striped pillar like the start arch in the studio's +1 Slide Downhill: a plinth with a
 * trim, alternating bands up the shaft, a cap block on top, and (optionally) a column of
 * lights down the two faces you look at.
 *
 * @param {'x'|'z'} facing axis the lit faces point along
 * @param {{ width?: number, lights?: boolean, colors?: typeof ARCH_COLORS }} options
 * @returns the blocks, and `cap` (the cap's centre, for a glow)
 */
export function stripedPillar(x, z, height, facing = 'z', { width = 1.6, lights = true, colors = ARCH_COLORS } = {}) {
  const out = []
  out.push({ matrix: boxMatrix(x, 0.45, z, width + 0.8, 0.9, width + 0.8), color: colors.base })
  out.push({ matrix: boxMatrix(x, 0.97, z, width + 0.4, 0.14, width + 0.4), color: colors.band })
  const bands = Math.max(3, Math.round((height - 1) / 1.2))
  const band = (height - 1) / bands
  for (let i = 0; i < bands; i += 1) {
    out.push({ matrix: boxMatrix(x, 1 + band * (i + 0.5), z, width, band, width), color: i % 2 ? colors.band : colors.body })
  }
  const cap = { x, y: height + 0.9, z }
  // The collar under the cap stays 15 cm inside the cap's faces: any closer and the
  // two flicker against each other at a distance (z-fighting).
  out.push({ matrix: boxMatrix(x, height + 0.12, z, width + 0.1, 0.24, width + 0.1), color: colors.base })
  out.push({ matrix: boxMatrix(x, cap.y, z, width + 0.4, width + 0.4, width + 0.4), color: colors.cap })
  if (lights) {
    const face = width / 2 + 0.06
    for (let y = 1.7, i = 0; y < height - 0.6; y += 1.1, i += 1) {
      const color = i % 2 ? colors.cap : PALETTE.white
      for (const side of [-1, 1]) {
        const px = facing === 'x' ? x + side * face : x
        const pz = facing === 'z' ? z + side * face : z
        out.push({ matrix: boxMatrix(px, y, pz, 0.32, 0.32, 0.32), color })
      }
    }
  }
  return { blocks: out, cap }
}
