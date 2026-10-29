import { RARITIES } from '@shared'

import { SPRITE, fxBatch } from '../render/fxBatch'

/**
 * Every spinner glows: the rarer it is, the brighter and bigger its aura. The body's own
 * glow (a shader value, free) is on at every quality; the soft halo and the spinning
 * ring round Epic and above are fx sprites, so callers draw them only when the preset
 * has glow (see pushAura).
 *
 * Level 0 (Common) .. 6 (Secret). Golden spinners shine at least like Legendary, in gold.
 */
const AURA = [
  { body: 0.18, alpha: 0.1, size: 1.7 },
  { body: 0.28, alpha: 0.14, size: 1.8 },
  { body: 0.4, alpha: 0.18, size: 2.0 },
  { body: 0.55, alpha: 0.24, size: 2.2 },
  { body: 0.7, alpha: 0.3, size: 2.4 },
  { body: 0.85, alpha: 0.36, size: 2.6 },
  { body: 1, alpha: 0.42, size: 2.8 },
]
/** From this level up the aura also has a turning ring on the floor in the 2nd colour. */
const RING_LEVEL = 3

export function auraLevel(def, golden) {
  const order = RARITIES[def.rarity]?.order ?? 0
  return Math.max(order, def.glow ? 3 : 0, golden ? 4 : 0)
}

/** The body's own glow (0-1) for a level. */
export const auraBody = (level) => AURA[level].body

/**
 * The halo (and ring) round one spinner. `t` is in seconds, `phase` offsets the pulse so
 * a team doesn't breathe in step.
 */
export function pushAura(x, y, z, scale, pal, level, golden, t, phase) {
  const a = AURA[level]
  const pulse = 0.82 + 0.18 * Math.sin(t * 2.2 + phase)
  const alpha = a.alpha * pulse
  if (golden) fxBatch.push(x, y + 0.35, z, a.size * scale, 1, 0.82, 0.25, alpha, SPRITE.glow)
  else fxBatch.push(x, y + 0.35, z, a.size * scale, pal.a.r, pal.a.g, pal.a.b, alpha, SPRITE.glow)
  if (level >= RING_LEVEL) {
    fxBatch.push(x, y + 0.08, z, a.size * scale * 1.05, pal.b.r, pal.b.g, pal.b.b, alpha * 0.9, SPRITE.ring, true, t * 0.9 + phase)
  }
}
