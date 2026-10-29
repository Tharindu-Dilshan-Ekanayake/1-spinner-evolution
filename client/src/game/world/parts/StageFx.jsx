import { STAGE, gateZ, playerPad } from '@shared'

import { live } from '../../../store/live'
import { quality } from '../../../store/qualityStore'
import { ORDER, useSystem } from '../../loop'
import { SPRITE, fxBatch } from '../../render/fxBatch'
import { TORCH } from './stageProps'

const TORCH_RANGE = 70
const MARKER_RANGE = 40

/**
 * Live touches on a stage line, all quads in the shared fx batch:
 *  - the next stage's blue pad pulses, with a beam (every preset: it tells you where
 *    to go; first-time players also get the guide arrows, see Guide.jsx);
 *  - torch flames flicker at the gates near you (presets with glow only).
 */
export function StageFx({ worldId, n }) {
  useSystem(ORDER.world, () => {
    const p = live.player
    const t = performance.now() * 0.001
    const run = live.run && live.run.world === worldId ? live.run : null
    const k = (run ? run.cleared : 0) + 1

    // The next stage's gate is always open (it opens when the one before is beaten).
    if (!live.battle && k <= n) {
      const pad = playerPad(k)
      const dz = pad.z - p.z
      if (Math.abs(dz) < MARKER_RANGE) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 4)
        const y = STAGE.padTop + 0.06
        fxBatch.push(pad.x, y, pad.z, STAGE.padSize * (1.15 + pulse * 0.2), 0.3, 0.75, 1, 0.55 + pulse * 0.35, SPRITE.ring, true, t)
        fxBatch.push(pad.x, y + 2.2, pad.z, 3.4, 0.3, 0.7, 1, 0.22, SPRITE.glow, false, 0, 3.2)
      }
    }

    // Pads of stages already cleared in this run glow softly: step on one to fight it again.
    if (run && !live.battle) {
      for (let j = 1; j <= Math.min(run.cleared, n); j += 1) {
        const pad = playerPad(j)
        if (Math.abs(pad.z - p.z) > MARKER_RANGE) continue
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.5 + j)
        fxBatch.push(pad.x, STAGE.padTop + 0.06, pad.z, STAGE.padSize * (1.08 + pulse * 0.1), 0.45, 0.8, 1, 0.22 + pulse * 0.16, SPRITE.ring, true, t)
      }
    }

    if (!quality().glow) return
    for (let g = 1; g <= n; g += 1) {
      const z = gateZ(g) + TORCH.dz
      if (Math.abs(z - p.z) > TORCH_RANGE) continue
      for (let side = -1; side <= 1; side += 2) {
        const flicker = 0.85 + Math.sin(t * 13 + g * 3 + side) * 0.1 + Math.sin(t * 29 + g) * 0.05
        fxBatch.push(side * TORCH.x, TORCH.flameY, z, 3.2 * flicker, 1, 0.5, 0.12, 0.75, SPRITE.glow, false, 0, 1.3)
        fxBatch.push(side * TORCH.x, TORCH.flameY - 0.1, z, 1.3 * flicker, 1, 0.9, 0.5, 1, SPRITE.glow)
      }
    }
  })
  return null
}

export default StageFx
