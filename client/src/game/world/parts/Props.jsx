import { InstancedSet } from './Instanced'
import { getBlockMaterial } from './shared'

/**
 * Decorations. Everything box-shaped (trees, flowers, logs, crates, lamp posts) goes
 * into ONE instanced set with per-instance colours.
 */

/** All box decor in one draw call. */
export function DecorBlocks({ blocks, castShadow = false }) {
  return <InstancedSet items={blocks} material={getBlockMaterial()} castShadow={castShadow} />
}
