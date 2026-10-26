import { boxMatrix } from './builders'

/**
 * Box-decor recipes: each returns { matrix, color } blocks for DecorBlocks.
 */

/** Voxel tree: trunk + three canopy blocks. */
export function treeBlocks(x, z, s = 1, leaf = '#2fbf3a', trunk = '#7a4a26') {
  return [
    { matrix: boxMatrix(x, 2 * s, z, 1.1 * s, 4 * s, 1.1 * s), color: trunk },
    { matrix: boxMatrix(x, 4.6 * s, z, 4.4 * s, 2.6 * s, 4.4 * s), color: leaf },
    { matrix: boxMatrix(x + 0.6 * s, 6.2 * s, z - 0.4 * s, 3.2 * s, 1.8 * s, 3.2 * s), color: leaf },
    { matrix: boxMatrix(x - 1.2 * s, 5.4 * s, z + 1 * s, 2.2 * s, 1.6 * s, 2.2 * s), color: leaf },
  ]
}

export function flowerBlocks(x, z, color = '#ff4d6d') {
  return [
    { matrix: boxMatrix(x, 0.35, z, 0.12, 0.7, 0.12), color: '#2e9a35' },
    { matrix: boxMatrix(x, 0.78, z, 0.45, 0.22, 0.45), color },
    { matrix: boxMatrix(x, 0.82, z, 0.18, 0.24, 0.18), color: '#ffe14d' },
  ]
}

export function logBlocks(x, z, ry = 0) {
  return [{ matrix: boxMatrix(x, 0.35, z, 3.2, 0.7, 0.8, ry), color: '#8a5530' }]
}

export function crateBlocks(x, z, s = 1, color = '#2fbf3a') {
  return [{ matrix: boxMatrix(x, 0.5 * s, z, s, s, s), color }]
}
