import { Color, MeshLambertMaterial } from 'three'

import { quality } from '../../store/qualityStore'
import { createStudTexture } from '../textures'

/**
 * Shared materials for the toy-brick world.
 *
 * All Lambert (matte), not MeshStandard: plastic bricks don't need PBR, and Lambert
 * shaders compile several times faster - shader compiles were the biggest single cost
 * of reaching the first playable frame on a phone.
 *
 * Every studded surface uses ONE grayscale stud texture, tinted by the material
 * colour - so the green grass, blue paths and orange trims all share a single 256-512 px
 * texture instead of one per colour. Materials are cached by colour and live for the
 * whole session (they're tiny and reused by every world); world-specific resources
 * such as sign atlases are disposed when their world unmounts.
 */

let studTexture = null

export function getStudTexture() {
  if (!studTexture) {
    const size = quality().textureSize
    // Light grey (not white) so the stud highlights still have room to brighten.
    studTexture = createStudTexture({ base: '#e4e4e4', alt: '#d9dadd', studsPerCell: 2, cellsPerTile: 2, size })
    studTexture.anisotropy = 8
  }
  return studTexture
}

const studCache = new Map()
const plainCache = new Map()
const glowCache = new Map()

/** Studded, tinted surface (ground, walls, trims). */
export function studMaterial(color) {
  let m = studCache.get(color)
  if (!m) {
    m = new MeshLambertMaterial({ map: getStudTexture(), color: new Color(color) })
    studCache.set(color, m)
  }
  return m
}

/** Smooth plastic, for props. Lambert is cheaper and reads the same at a distance. */
export function plainMaterial(color) {
  let m = plainCache.get(color)
  if (!m) {
    m = new MeshLambertMaterial({ color: new Color(color) })
    plainCache.set(color, m)
  }
  return m
}

/** Self-lit neon (portal rims, lava, lamp tops) - no bloom needed. */
export function glowMaterial(color, intensity = 1) {
  const key = `${color}|${intensity}`
  let m = glowCache.get(key)
  if (!m) {
    m = new MeshLambertMaterial({ color: new Color(color), emissive: new Color(color), emissiveIntensity: intensity })
    glowCache.set(key, m)
  }
  return m
}
