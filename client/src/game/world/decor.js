import { boxMatrix } from './parts/builders'
import { crateBlocks, flowerBlocks, treeBlocks } from './parts/decorBlocks'

/* ---------------------------------------------------------------------------
 * Decor recipes per world (used by the lazy world modules)
 * ------------------------------------------------------------------------- */

export const DECOR = {
  grass(k, z) {
    return [
      ...treeBlocks(-19, z + 12, 0.8),
      ...treeBlocks(-19, z - 10, 0.7, '#3fcf3a'),
      ...flowerBlocks(-14, z + 15, '#ff4d6d'),
      ...flowerBlocks(-12, z + 16, '#4dc3ff'),
      ...flowerBlocks(21, z + 9, '#ffffff'),
      ...crateBlocks(-20, z - 2, 1.4, '#2fbf3a'),
      ...crateBlocks(-21, z - 0.6, 0.9, '#ffd23a'),
    ]
  },
  lava(k, z) {
    return [
      ...crateBlocks(-19, z + 10, 2, '#3a2a2a'),
      ...crateBlocks(-17.5, z + 11.5, 1, '#ff5a12'),
      ...crateBlocks(20, z + 8, 1.5, '#2a1d1d'),
      ...crateBlocks(-20, z - 9, 1.2, '#ff8a1c'),
      ...treeBlocks(-19, z - 2, 0.7, '#ff5a12', '#2a1d1d'),
    ]
  },
  galaxy(k, z) {
    return [
      ...crateBlocks(-19, z + 10, 1.6, '#2cf3ff'),
      ...crateBlocks(-20, z - 8, 1.1, '#ff4df0'),
      ...crateBlocks(20, z + 9, 1.3, '#8a3dff'),
      ...treeBlocks(-18, z, 0.75, '#8a3dff', '#1a1a3a'),
    ]
  },
  halloween(k, z) {
    return [
      ...treeBlocks(-19, z + 11, 0.85, '#5b2a86', '#2b1a12'),
      ...treeBlocks(-19, z - 9, 0.7, '#3a1d4a', '#1a1010'),
      { matrix: boxMatrix(20, 2, z + 9, 0.35, 4, 0.35), color: '#1d1d2a' },
      { matrix: boxMatrix(20, 4.2, z + 9, 0.9, 0.7, 0.9), color: '#ffb300' },
    ]
  },
}
