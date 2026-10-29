import { CRYSTAL_POSITION, SHOP_PAD, SHOP_PADS } from '@shared'

/** The Spinners Shop pads' measurements (see Machines.jsx). */

/** One pad: plinth radius, rim height, and the dish's lowest point. */
export const STAND = { radius: SHOP_PAD.radius, height: 0.72, dishY: 0.5 }
export function dishHeight(r) {
  return STAND.dishY + 0.17 * r * r
}

/** The Crystal Spinner's pad is the same pad, bigger. */
export const CRYSTAL_PAD_SCALE = 1.7

/**
 * Every pad in the shop: one per spinner for sale, in its tier's colour, plus the
 * Crystal Spinner's. `scale` grows the whole pad.
 */
export function shopPadList(tierColors) {
  return [
    ...SHOP_PADS.map((p) => ({ x: p.x, z: p.z, scale: 1, color: tierColors[p.tier], id: p.id, tier: p.tier })),
    { ...CRYSTAL_POSITION, scale: CRYSTAL_PAD_SCALE, color: '#b98cff', id: 'crystal', tier: 'crystal' },
  ]
}
