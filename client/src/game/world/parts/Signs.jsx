import { use, useEffect, useMemo } from 'react'

import { useQuality } from '../../../store/qualityStore'
import { createSignAtlas } from '../../render/signAtlas'
import { fontsReady } from './signStyles'

/** One atlas + one draw call for every sign in `signs`; disposed on unmount. */
export function Signs({ signs }) {
  use(fontsReady)
  const q = useQuality()
  const atlas = useMemo(
    () =>
      createSignAtlas(signs, {
        atlasSize: q.textureSize >= 512 ? 1024 : 512,
        density: q.textureSize >= 512 ? 44 : 24,
      }),
    [signs, q.textureSize],
  )
  useEffect(() => () => atlas.dispose(), [atlas])
  return <primitive object={atlas.mesh} />
}
