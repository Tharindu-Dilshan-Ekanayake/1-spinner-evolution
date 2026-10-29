import { useThree } from '@react-three/fiber'
import { Suspense, use, useEffect, useMemo, useRef, useState } from 'react'
import { Mesh, MeshLambertMaterial } from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'

import { STAGE, enemyPad } from '@shared'

import { loadBaseBody } from '../../../bloxity/avatarLoader'
import { useGameStore } from '../../../store/gameStore'
import { live } from '../../../store/live'
import { useQuality } from '../../../store/qualityStore'
import { MOOD, applyProportions, collectRig, gameProportions, poseChampion } from '../../avatarRig'
import { ORDER, useSystem } from '../../loop'
import { overlay } from '../../overlay/worldOverlay'
import { SPRITE, shadowBatch } from '../../render/fxBatch'
import { capGeometry, championLook, championTexture, getCapMaterial, mergeBody } from './championParts'

/** A little taller than a player (1.8), so the champion reads from the blue pad. */
const HEIGHT = 2.1
/** player.glb stands 6.4 units tall with its feet at y = 0. */
const RIG_SCALE = HEIGHT / 6.4
/** Champions share the players' build (see GAME_BODY). */
const BODY = gameProportions({})
const NAME_RANGE = 34
const POLL_MS = 300

/**
 * Which stages get a champion right now: the closest ones, preferring stages ahead of
 * the player (on the blue pad of stage k, stage k-1's champion is nearer but behind).
 */
function pickStages(n, max, worldId) {
  const pz = live.player.z
  const ranked = []
  for (let k = 1; k <= n; k += 1) {
    const d = enemyPad(k).z - pz
    ranked.push({ k, cost: d > 0 ? d * 2.5 : -d })
  }
  ranked.sort((a, b) => a.cost - b.cost)
  const picked = ranked.slice(0, max).map((r) => r.k)
  // The champion you are fighting is always there.
  const b = live.battle
  if (b && b.world === worldId && !picked.includes(b.stage)) picked[picked.length - 1] = b.stage
  return picked.sort((a, b2) => a - b2)
}

function Champion({ worldId, k }) {
  const { scene } = use(loadBaseBody())
  const look = useMemo(() => championLook(worldId, k), [worldId, k])

  const built = useMemo(() => {
    const character = cloneSkeleton(scene)
    const rig = collectRig(character)
    const texture = championTexture(look)
    const material = new MeshLambertMaterial({ map: texture })
    const merged = mergeBody(rig, material)
    // Built in the rig's space on top of the head, then handed to the neck bone so it
    // follows every nod.
    const cap = new Mesh(capGeometry(look), getCapMaterial())
    character.add(cap)
    character.updateMatrixWorld(true)
    if (rig.hatBone) rig.hatBone.attach(cap)
    return { character, rig, texture, material, merged, cap }
  }, [scene, look])

  useEffect(
    () => () => {
      built.texture.dispose()
      built.material.dispose()
      built.merged?.dispose()
      built.cap.geometry.dispose()
    },
    [built],
  )

  // Champions arrive after the startup shader warm-up, so compile theirs in the
  // background and only show them once ready: no compile stall mid-game.
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const world = useThree((s) => s.scene)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    const show = () => {
      if (alive) setReady(true)
    }
    gl.compileAsync(built.character, camera, world).then(show, show)
    return () => {
      alive = false
    }
  }, [gl, camera, world, built])

  const pad = enemyPad(k)
  const clock = useRef(k * 1.7)
  useSystem(ORDER.world, (dt, state) => {
    const b = live.battle
    let mood = MOOD.idle
    if (b && b.world === worldId && b.stage === k) {
      if (!b.ended) mood = MOOD.cheer
      else mood = b.result === 'win' ? MOOD.beaten : MOOD.victory
    }
    clock.current += dt
    applyProportions(built.rig, BODY)
    poseChampion(built.rig, clock.current, mood)
    shadowBatch.push(pad.x, STAGE.padTop + 0.03, pad.z, 2.4, 0, 0, 0.05, 0.45, SPRITE.glow, true)
    if (!b) {
      const dx = pad.x - live.player.x
      const dz = pad.z - live.player.z
      if (dx * dx + dz * dz < NAME_RANGE * NAME_RANGE) {
        overlay.name(state.camera, pad.x, STAGE.padTop + HEIGHT + 0.75, pad.z, look.name, look.title)
      }
    }
  })

  return (
    <group position={[pad.x, STAGE.padTop, pad.z]} scale={RIG_SCALE} visible={ready}>
      <primitive object={built.character} />
    </group>
  )
}

/**
 * The trainers on the red pads: Bloxity champions in team kit. Only the stages
 * around the player get one (LOW 1, MEDIUM 2, HIGH 3); the set is re-picked a few
 * times a second outside the frame loop.
 */
export function Champions({ worldId, n }) {
  // Not needed for the first frame (the nearest stands ~70 units from spawn): build them
  // once the game has settled, so they never delay time-to-playable.
  const settled = useGameStore((s) => s.settled)
  if (!settled) return null
  return <ChampionSet worldId={worldId} n={n} />
}

function ChampionSet({ worldId, n }) {
  const { champions: max } = useQuality()
  const [shown, setShown] = useState(() => pickStages(n, max, worldId))

  useEffect(() => {
    const tick = () => {
      const next = pickStages(n, max, worldId)
      setShown((prev) => (prev.length === next.length && prev.every((k, i) => k === next[i]) ? prev : next))
    }
    tick()
    const timer = setInterval(tick, POLL_MS)
    return () => clearInterval(timer)
  }, [n, max, worldId])

  return (
    <Suspense fallback={null}>
      {shown.map((k) => (
        <Champion key={k} worldId={worldId} k={k} />
      ))}
    </Suspense>
  )
}

export default Champions
