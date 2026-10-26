import { RING_LIST } from '@shared'

/**
 * Per-ring hit feedback for the training dummies: `flash` (white flash) and `shake`
 * decay from 1 to 0. Written by the pets system on hits, read by TrainingRings.
 */
export const ringFx = Object.fromEntries(RING_LIST.map((r) => [r.id, { flash: 0, shake: 0 }]))
