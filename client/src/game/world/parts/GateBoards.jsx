import { use, useEffect, useMemo, useRef } from 'react'
import { InstancedMesh, Matrix4 } from 'three'

import { gateZ } from '@shared'

import { live } from '../../../store/live'
import { useQuality } from '../../../store/qualityStore'
import { ORDER, useSystem } from '../../loop'
import { glowMaterial } from '../../render/materials'
import { createSignAtlas } from '../../render/signAtlas'
import { PALETTE } from '../../sceneStyle'
import { doorBox } from './doorParts'
import { unitBox } from './shared'
import { fontsReady } from './signStyles'

/** How far past a gate (towards spawn, +Z) its board starts to roll up. */
const ROLL_UP_AT = 1.5
const PANEL_DEPTH = 0.5
const _m = new Matrix4()

/**
 * The boards hung inside stage gates ("STAGE 1 / 10 HP"), with their backing panels.
 * Each one rolls up into its gate's top bar once you walk through that gate - so it
 * never blocks the camera's view into the stage - and back down when you come out.
 *
 * @param {{ items: Array<{ k: number, door: object, sign: object }> }} props
 *   `door.board` gives the panel's size; `sign` is the board's sign (doorScreenSign).
 */
export function GateBoards({ items }) {
  use(fontsReady)
  const q = useQuality()
  const signs = useMemo(() => items.map((it) => it.sign), [items])
  const atlas = useMemo(
    () =>
      // The packer lowers the density by itself if the signs don't fit.
      createSignAtlas(signs, { atlasSize: q.signAtlas, density: q.signAtlas / 23 }),
    [signs, q.signAtlas],
  )
  useEffect(() => () => atlas.dispose(), [atlas])

  const panels = useMemo(() => {
    const mesh = new InstancedMesh(unitBox, glowMaterial(PALETTE.navy, 0.15), items.length)
    items.forEach((it, i) => {
      const b = it.door.board
      mesh.setMatrixAt(i, doorBox(it.door, 0, b.y, 0, b.w, b.h, PANEL_DEPTH, _m))
    })
    // Instances change size as boards roll; a stale bounding sphere must not cull them.
    mesh.frustumCulled = false
    return mesh
  }, [items])
  useEffect(() => () => panels.dispose(), [panels])

  // How far down each board is (1 = fully shown), per atlas; -1 = not placed yet.
  const shown = useRef({ atlas: null, values: [] })
  const panelRef = useRef(null)

  useSystem(ORDER.world, (dt) => {
    const mesh = panelRef.current
    if (!mesh) return
    const state = shown.current
    if (state.atlas !== atlas) {
      state.atlas = atlas
      state.values = items.map(() => -1)
    }
    const pz = live.player.z
    const ease = Math.min(1, dt * 7)
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i]
      const target = pz > gateZ(it.k) + ROLL_UP_AT ? 1 : 0
      const prev = state.values[i]
      let next = prev < 0 ? target : prev + (target - prev) * ease
      if (Math.abs(next - target) < 0.003) next = target
      if (next === prev) continue
      state.values[i] = next
      atlas.setShown(i, next)
      const b = it.door.board
      if (next > 0.001) doorBox(it.door, 0, b.y + (b.h / 2) * (1 - next), 0, b.w, b.h * next, PANEL_DEPTH, _m)
      else _m.makeScale(0, 0, 0)
      mesh.setMatrixAt(i, _m)
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <>
      <primitive ref={panelRef} object={panels} />
      <primitive object={atlas.mesh} />
    </>
  )
}

export default GateBoards
