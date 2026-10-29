import { useFrame } from '@react-three/fiber'
import { forwardRef, use, useEffect, useMemo, useRef, useState } from 'react'
import { Box3, DataTexture, MeshLambertMaterial, SRGBColorSpace, Vector3 } from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'

import {
  assetUrls,
  isRealId,
  PART_SLOTS,
  skinCompositeUrl,
  skinIdOrDefault,
} from '../bloxity/avatarAssets'
import { loadBaseBody, loadOBJ, loadPartGLB, loadTexture } from '../bloxity/avatarLoader'
import { applyEmote } from '../bloxity/emotes'
import { useBloxity } from '../bloxity/BloxityContext'
import { DEFAULT_PROPORTIONS } from '../bloxity/store'
import {
  animateRig,
  applyPart,
  applyProportions,
  applySkin,
  attachAccessory,
  collectRig,
  gameProportions,
} from './avatarRig'

/**
 * Keeps the avatar breathing when it is rendered outside the game (a menu preview,
 * say) with no physics body feeding it motion.
 */
const _idleMotion = { time: 0, speed: 0, grounded: true, maxSpeed: 6 }
function fallbackMotion(delta) {
  _idleMotion.time += delta
  return _idleMotion
}

/**
 * A 1x1 white skin every avatar starts with. The material is compiled with a map from
 * the start, so swapping in the real skin later is a texture change, not a fresh shader
 * compile (that compile stalled the first second of play).
 */
const BLANK_SKIN = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
BLANK_SKIN.colorSpace = SRGBColorSpace
BLANK_SKIN.flipY = false
BLANK_SKIN.needsUpdate = true

/** Stand-in for the Bloxity loading helpers when assembling someone else's avatar. */
const QUIET_GAME = { loadingStep() {}, loadingEnd() {}, updateRoom() {} }

/**
 * The player's own Bloxity avatar, assembled at runtime.
 *
 * `player.glb` is the base humanoid rig: six skinned meshes (head, torso, two arms,
 * two legs) sharing one skeleton. Assembly means, per equipped slot:
 *   - body parts  -> swap the matching mesh's geometry
 *   - hat / back  -> attach an OBJ to the Neck1 / Spine2 bone
 *   - skin        -> set one texture as the map on every skinned mesh
 *
 * Any slot that is unequipped or 404s leaves the base body's own part in place. The
 * whole thing re-assembles when `onAvatarChanged` / `onProportionsChanged` fire, so
 * changing cosmetics in the Bloxity portal updates the character live.
 *
 * @param {{ onReady?: () => void, targetHeight?: number, remote?: { equipped, proportions } }} props
 *   `targetHeight` is the world-space height to fit the avatar into, in the game's
 *   own units. Bloxity authors the rig ~6.4 units tall with the feet at y=0, which is
 *   far bigger than a metric-scale physics capsule, so the model is measured and
 *   rescaled rather than trusted at native size.
 *   `remote` draws another player's look (synced through the game server) instead of
 *   the signed-in user's.
 */
export const PlayerAvatar = forwardRef(function PlayerAvatar(
  { onReady, onMounted, targetHeight = 1.8, motionRef, remote, ...props },
  ref,
) {
  const local = useBloxity()
  const equipped = remote ? remote.equipped : local.avatar
  const proportions = remote ? remote.proportions || DEFAULT_PROPORTIONS : local.proportions
  // Only our own avatar reports to the Bloxity loading screen.
  const game = remote ? QUIET_GAME : local.game
  // Suspends until player.glb is in (shared by every avatar).
  const { scene: baseScene } = use(loadBaseBody())
  const [assembled, setAssembled] = useState(false)

  // The GLTF cache hands back one shared scene. Clone via SkeletonUtils so this
  // instance gets an independent, still-working skeleton.
  const character = useMemo(() => cloneSkeleton(baseScene), [baseScene])

  // Rig lookup tables (bones, part meshes, pristine geometries) built once per clone.
  const rig = useMemo(() => {
    const collected = collectRig(character)

    // The base body ships with an empty texture; give every skinned mesh its own
    // material instance so a skin swap here can't leak into another avatar.
    // Lambert: the same fully matte look as a rough, non-metal standard material,
    // for a fraction of the shader cost.
    for (const mesh of collected.skinnedMeshes) {
      mesh.material = new MeshLambertMaterial({ color: 0xffffff, map: BLANK_SKIN })
    }

    if (!collected.skeleton) {
      console.warn('[bloxity] player.glb has no skeleton - avatar will not deform')
    }
    return collected
  }, [character])

  // Measured once, from the bind pose, before proportions touch the root scale.
  const fit = useMemo(() => {
    const box = new Box3().setFromObject(character)
    const size = box.getSize(new Vector3())
    if (!Number.isFinite(size.y) || size.y <= 0) return { scale: 1, footOffset: 0 }
    const scale = targetHeight / size.y
    // The rig's feet sit at its bbox minimum; drop the group so they land on y=0
    // of the parent (which Player positions at the bottom of the capsule).
    return { scale, footOffset: -box.min.y * scale }
  }, [character, targetHeight])

  // --- Assemble equipped cosmetics --------------------------------------------
  useEffect(() => {
    let cancelled = false
    // Accessories are re-attached on every rebuild; track them so the previous
    // hat/back can be removed rather than stacking up.
    const attached = []

    game.loadingStep('Loading avatar…')

    const jobs = []

    // Skin always loads - "0" is the fallback, since the base body has no baked map.
    // With a face, shirt or pants worn it's the server-composited version; if that
    // can't be fetched, the bare skin is better than an untextured body.
    const compositeUrl = skinCompositeUrl(equipped)
    const plainSkinUrl = assetUrls.skinTexture(skinIdOrDefault(equipped?.skinId))
    jobs.push(
      (compositeUrl ? loadTexture(compositeUrl) : Promise.resolve(null))
        .then((texture) => texture || loadTexture(plainSkinUrl))
        .then((texture) => ({ kind: 'skin', texture })),
    )

    // Body parts: fetch only real ids; a missing slot resets to the base geometry.
    for (const [slot, cfg] of Object.entries(PART_SLOTS)) {
      const id = equipped?.[cfg.idKey]
      if (!isRealId(id)) {
        jobs.push(Promise.resolve({ kind: 'part', slot, scene: null }))
        continue
      }
      jobs.push(
        loadPartGLB(assetUrls.part(slot, id)).then((scene) => ({
          kind: 'part',
          slot,
          scene,
        })),
      )
    }

    // Accessories.
    for (const [kind, idKey, meshUrl, texUrl] of [
      ['hat', 'hatId', assetUrls.hatMesh, assetUrls.hatTexture],
      // Hair and masks are worn with a hat, and load exactly like one.
      ['hair', 'hairId', assetUrls.hatMesh, assetUrls.hatTexture],
      ['mask', 'maskId', assetUrls.hatMesh, assetUrls.hatTexture],
      ['back', 'backId', assetUrls.backMesh, assetUrls.backTexture],
    ]) {
      const id = equipped?.[idKey]
      if (!isRealId(id)) continue
      jobs.push(
        Promise.all([loadOBJ(meshUrl(id)), loadTexture(texUrl(id))]).then(
          ([object, texture]) => ({ kind: 'accessory', accessory: kind, object, texture }),
        ),
      )
    }

    Promise.all(jobs)
      .then((results) => {
        if (cancelled) return

        for (const result of results) {
          // One bad slot must not take the rest of the character down.
          try {
            if (result.kind === 'skin') {
              applySkin(rig, result.texture)
            } else if (result.kind === 'part') {
              applyPart(rig, result.slot, result.scene)
            } else if (result.kind === 'accessory' && result.object) {
              if (result.texture) {
                result.object.traverse((child) => {
                  if (child.isMesh) {
                    child.material = new MeshLambertMaterial({ map: result.texture })
                  }
                })
              }
              const added = attachAccessory(rig, result.accessory, result.object)
              if (added) attached.push(added)
            }
          } catch (err) {
            console.warn(`[bloxity] failed to apply ${result.kind}`, err)
          }
        }

        setAssembled(true)
      })
      .catch((err) => {
        console.warn('[bloxity] avatar assembly failed; showing base body', err)
        if (!cancelled) setAssembled(true)
      })

    return () => {
      cancelled = true
      for (const object of attached) {
        object.parent?.remove(object)
        object.traverse((child) => child.geometry?.dispose())
      }
    }
  }, [rig, equipped, game])

  // --- Proportions -------------------------------------------------------------
  // Applied per frame rather than in an effect: every bone is reset to its rest pose
  // and re-scaled each pass, which keeps it idempotent and survives anything else
  // that touches the skeleton.
  // The player's own proportions, with this game's body shape on top.
  const body = useMemo(() => gameProportions(proportions), [proportions])
  const bodyRef = useRef(body)
  bodyRef.current = body

  useFrame((_state, delta) => {
    try {
      // Order matters: proportions reset every bone to its rest pose, and the
      // animation then rotates on top of that clean base.
      applyProportions(rig, bodyRef.current)
      const motion = motionRef?.current ?? fallbackMotion(delta)
      animateRig(rig, motion)
      // A Boxity emote plays over the pose (see bloxity/emotes.js).
      if (motion.boxity) applyEmote(rig, motion.boxity, motion.time)
    } catch {
      // A malformed payload must not kill the render loop.
    }
  })

  // The base body is on screen as soon as this component renders (useGLTF suspends
  // until then); cosmetics may still be streaming in.
  useEffect(() => {
    onMounted?.()
  }, [onMounted])

  // Signal readiness only once the model is actually standing there.
  useEffect(() => {
    if (assembled) onReady?.()
  }, [assembled, onReady])

  return (
    <group ref={ref} {...props}>
      {/* Fit scale lives on this wrapper, not on `character` - applyProportions
          overwrites the character's own scale every frame. */}
      <group scale={fit.scale} position={[0, fit.footOffset, 0]}>
        <primitive object={character} />
      </group>
    </group>
  )
})

// Start downloading the body as soon as this module loads.
loadBaseBody()

export default PlayerAvatar
