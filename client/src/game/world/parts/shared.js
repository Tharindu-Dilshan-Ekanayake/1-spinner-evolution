import { BoxGeometry, CylinderGeometry, MeshLambertMaterial } from 'three'

import { getStudTexture } from '../../render/materials'

/**
 * Geometry and materials shared by every world. Created once, reused all session
 * (they're tiny), so unmounting a world never disposes them.
 */

export const unitBox = new BoxGeometry(1, 1, 1)
export const unitCylinder = new CylinderGeometry(1, 1, 1, 40, 1)

let blockMaterial = null

/** One white stud material for instanced blocks; instance colours tint it. */
export function getBlockMaterial() {
  if (!blockMaterial) {
    blockMaterial = new MeshLambertMaterial({ map: getStudTexture(), color: '#ffffff' })
  }
  return blockMaterial
}
