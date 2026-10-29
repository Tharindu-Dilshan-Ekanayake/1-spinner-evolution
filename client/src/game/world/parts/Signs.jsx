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
      // The packer lowers the density by itself if the signs don't fit.
      createSignAtlas(signs, { atlasSize: q.signAtlas, density: q.signAtlas / 23 }),
    [signs, q.signAtlas],
  )
  useEffect(() => () => atlas.dispose(), [atlas])
  return <primitive object={atlas.mesh} />
}
