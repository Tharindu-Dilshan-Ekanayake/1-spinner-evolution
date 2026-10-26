/**
 * Tiny collision world for the kinematic player controller.
 *
 * The game is built from flat islands, boxes and round arenas, so three shape types
 * cover everything - no physics engine (and its ~2 MB of WASM) needed:
 *   floors  - walkable rectangles: { minX, maxX, minZ, maxZ, top }
 *   boxes   - solid boxes: { minX, maxX, minZ, maxZ, minY, maxY, enabled?() }
 *   circles - solid cylinders: { x, z, r, minY, maxY }
 *
 * Each world registers its shapes under its own layer name on mount and removes them
 * on unmount, so only the loaded world is ever tested.
 */

const layers = new Map()
/** Flat copy of layers.values(), so per-frame queries don't allocate iterators. */
let layerList = []

export function setColliders(name, { floors = [], boxes = [], circles = [] }) {
  layers.set(name, { floors, boxes, circles })
  layerList = [...layers.values()]
}

export function clearColliders(name) {
  layers.delete(name)
  layerList = [...layers.values()]
}

/** How far up a step can be walked onto without jumping. */
const STEP = 0.6

/**
 * Highest floor under (x, z) that isn't more than a step above `y`, or -Infinity
 * when there is nothing below (the player falls).
 */
export function groundAt(x, z, y) {
  let best = -Infinity
  for (let l = 0; l < layerList.length; l += 1) {
    const layer = layerList[l]
    const floors = layer.floors
    for (let i = 0; i < floors.length; i += 1) {
      const f = floors[i]
      if (x < f.minX || x > f.maxX || z < f.minZ || z > f.maxZ) continue
      if (f.top <= y + STEP && f.top > best) best = f.top
    }
  }
  return best
}

/** Pushes `pos` (mutated) out of every solid it overlaps. */
export function resolveSolids(pos, radius, height) {
  for (let l = 0; l < layerList.length; l += 1) {
    const layer = layerList[l]
    const boxes = layer.boxes
    for (let i = 0; i < boxes.length; i += 1) {
      const b = boxes[i]
      if (b.enabled && !b.enabled()) continue
      if (pos.y + height < b.minY || pos.y > b.maxY - 0.05) continue
      // Closest point on the box rectangle.
      const cx = pos.x < b.minX ? b.minX : pos.x > b.maxX ? b.maxX : pos.x
      const cz = pos.z < b.minZ ? b.minZ : pos.z > b.maxZ ? b.maxZ : pos.z
      const dx = pos.x - cx
      const dz = pos.z - cz
      const d2 = dx * dx + dz * dz
      if (d2 >= radius * radius) continue
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2)
        pos.x = cx + (dx / d) * radius
        pos.z = cz + (dz / d) * radius
      } else {
        // Centre inside the box: leave by the nearest face.
        const left = pos.x - b.minX
        const right = b.maxX - pos.x
        const back = pos.z - b.minZ
        const front = b.maxZ - pos.z
        const m = Math.min(left, right, back, front)
        if (m === left) pos.x = b.minX - radius
        else if (m === right) pos.x = b.maxX + radius
        else if (m === back) pos.z = b.minZ - radius
        else pos.z = b.maxZ + radius
      }
    }

    const circles = layer.circles
    for (let i = 0; i < circles.length; i += 1) {
      const c = circles[i]
      if (pos.y + height < c.minY || pos.y > c.maxY - 0.05) continue
      const dx = pos.x - c.x
      const dz = pos.z - c.z
      const min = c.r + radius
      const d2 = dx * dx + dz * dz
      if (d2 >= min * min) continue
      const d = Math.sqrt(d2) || 0.0001
      pos.x = c.x + (dx / d) * min
      pos.z = c.z + (dz / d) * min
    }
  }
}

/** Top of any solid the player is standing on (lets you jump onto boxes). */
export function solidTopAt(x, z, y, radius) {
  let best = -Infinity
  for (let l = 0; l < layerList.length; l += 1) {
    const layer = layerList[l]
    for (let i = 0; i < layer.boxes.length; i += 1) {
      const b = layer.boxes[i]
      if (b.enabled && !b.enabled()) continue
      if (x < b.minX - radius * 0.5 || x > b.maxX + radius * 0.5) continue
      if (z < b.minZ - radius * 0.5 || z > b.maxZ + radius * 0.5) continue
      if (b.maxY <= y + 0.05 && b.maxY > best) best = b.maxY
    }
  }
  return best
}

/**
 * How far a camera can sit from (x, y, z) along the unit direction (dx, dy, dz)
 * before entering a solid box - so walls don't come between the camera and the
 * player. Barriers with an enabled() switch (gates) are glass: ignored.
 */
export function cameraClearance(x, y, z, dx, dy, dz, maxDistance) {
  const step = 0.5
  for (let t = step; t <= maxDistance; t += step) {
    const px = x + dx * t
    const py = y + dy * t
    const pz = z + dz * t
    for (let l = 0; l < layerList.length; l += 1) {
      const boxes = layerList[l].boxes
      for (let i = 0; i < boxes.length; i += 1) {
        const b = boxes[i]
        if (b.enabled) continue
        if (px > b.minX - 0.3 && px < b.maxX + 0.3 && pz > b.minZ - 0.3 && pz < b.maxZ + 0.3 && py > b.minY && py < b.maxY + 0.4) {
          return Math.max(1.5, t - step)
        }
      }
    }
  }
  return maxDistance
}
