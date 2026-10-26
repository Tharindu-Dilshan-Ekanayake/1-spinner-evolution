import { arenaZ } from '@shared'

import { DECOR } from '../decor'
import StageWorld from '../StageWorld'

/** Pumpkins and graves along every stage of the Halloween event. */
const EXTRAS = {
  pumpkins: (n) =>
    Array.from({ length: n }, (_, i) => [
      { x: -20, z: arenaZ(i + 1) + 6, s: 1.3 },
      { x: -18.5, z: arenaZ(i + 1) + 8, s: 0.8 },
      { x: 21, z: arenaZ(i + 1) - 7, s: 1 },
    ]).flat(),
  graves: (n) =>
    Array.from({ length: n }, (_, i) => [
      { x: -21, z: arenaZ(i + 1) - 3, ry: 0.3 },
      { x: -18, z: arenaZ(i + 1) - 6, ry: -0.4 },
      { x: 21.5, z: arenaZ(i + 1) + 4, ry: 0.2 },
    ]).flat(),
}

/**
 * The Halloween event world: 8 spooky stages that pay candy (spent on the Halloween
 * Capsule and the Spooky Aura). Loaded lazily.
 */
export default function HalloweenWorld() {
  return <StageWorld worldId="halloween" decor={DECOR.halloween} extras={EXTRAS} />
}
