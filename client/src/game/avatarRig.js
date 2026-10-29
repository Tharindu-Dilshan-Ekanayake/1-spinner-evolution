import { NearestFilter, Quaternion, SRGBColorSpace, Vector3 } from 'three'

import { BACK_BONE, HAT_BONE, NECK_OFFSET_BONE, PART_SLOTS } from '../bloxity/avatarAssets'

/**
 * Rig manipulation for the base `player.glb` character.
 *
 * The rig's real structure (confirmed by reading player.glb directly):
 *   character
 *     - default_arm_L / default_arm_R / default_head
 *     - default_leg_L / default_leg_R / default_torso   (6 SkinnedMeshes, 1 skeleton)
 *     - Rig1
 *         - Spine1 > Spine2 > { ArmL_Offset > ArmL1 > ArmL2,
 *                               ArmR_Offset > ArmR1 > ArmR2,
 *                               Neck_Offset > Neck1 }
 *         - LegL_Offset > LegL1 > LegL2, LegR_Offset > LegR1 > LegR2
 *
 * Two consequences drive everything below:
 *  1. Body parts are NOT attached to bones. Each is a separate SkinnedMesh sharing one
 *     skeleton, so equipping a part means swapping that mesh's geometry (remapping
 *     skin indices into the base skeleton's bone order first).
 *  2. Accessories DO attach to bones: hats to `Neck1`, back items to `Spine2`.
 *
 * player.glb ships no animation clips, so the character is posed, not animated.
 */

/**
 * Walks the loaded rig and collects everything later operations need.
 *
 * @param {import('three').Object3D} root
 */
export function collectRig(root) {
  const rig = {
    root,
    skeleton: null,
    /** slot -> SkinnedMesh */
    partMeshes: {},
    /** slot -> the pristine geometry to restore on unequip */
    originalGeometries: {},
    /** bone name -> { bone, origPos, origQuat, origScale } */
    bones: {},
    hatBone: null,
    backBone: null,
    neckOffsetBindY: 0,
    skinnedMeshes: [],
    /** Rest Y of the character root, so the run-cycle bob can return to it. */
    rootRestY: root.position.y,
  }

  const meshBySlot = new Map(
    Object.entries(PART_SLOTS).map(([slot, cfg]) => [cfg.mesh.toLowerCase(), slot]),
  )

  root.traverse((node) => {
    if (node.isSkinnedMesh) {
      node.castShadow = true
      node.receiveShadow = true
      rig.skinnedMeshes.push(node)
      if (!rig.skeleton) rig.skeleton = node.skeleton

      const slot = meshBySlot.get((node.name || '').toLowerCase())
      if (slot) {
        rig.partMeshes[slot] = node
        rig.originalGeometries[slot] = node.geometry.clone()
      }
    } else if (node.isMesh) {
      node.castShadow = true
      node.receiveShadow = true
    }
  })

  const skeleton = rig.skeleton
  if (skeleton) {
    for (const bone of skeleton.bones) {
      // Proportions are re-applied every frame from these rest values.
      bone.matrixAutoUpdate = true
      rig.bones[bone.name] = {
        bone,
        origPos: bone.position.clone(),
        origQuat: bone.quaternion.clone(),
        origScale: bone.scale.clone(),
      }
    }

    // Bone local axes are NOT world-aligned in this rig: a limb bone's local X
    // points along world -Z and its local Z along world -X, so rotating a leg about
    // its local X swings it sideways instead of forward/back. The offsets differ per
    // bone (Spine1 is identity, ArmL2 is off by ~14 degrees), so rather than hardcode
    // an axis, record for each bone the local-space axis matching each character-space
    // axis and animate about those.
    root.updateMatrixWorld(true)
    const rootQuat = new Quaternion()
    root.getWorldQuaternion(rootQuat)
    const rootQuatInv = rootQuat.invert()
    const boneWorld = new Quaternion()

    for (const bone of skeleton.bones) {
      const entry = rig.bones[bone.name]
      if (!entry) continue
      bone.getWorldQuaternion(boneWorld)
      // Bone orientation relative to the character, then inverted: this maps a
      // character-space axis into the bone's own local frame.
      const relInv = rootQuatInv.clone().multiply(boneWorld).invert()
      /** Local axis to rotate about for forward/back swing. */
      entry.axisX = new Vector3(1, 0, 0).applyQuaternion(relInv).normalize()
      /** Local axis to rotate about for lateral sway. */
      entry.axisZ = new Vector3(0, 0, 1).applyQuaternion(relInv).normalize()
      /** Local axis to rotate about for a twist round the body. */
      entry.axisY = new Vector3(0, 1, 0).applyQuaternion(relInv).normalize()
    }

    rig.hatBone = skeleton.bones.find((b) => b.name === HAT_BONE) || null
    rig.backBone = skeleton.bones.find((b) => b.name === BACK_BONE) || null

    const neckIndex = skeleton.bones.findIndex((b) => b.name === NECK_OFFSET_BONE)
    if (neckIndex >= 0) {
      // elements[13] is the Y translation of the inverted bind matrix.
      rig.neckOffsetBindY = skeleton.boneInverses[neckIndex].clone().invert().elements[13]
    }
  }

  return rig
}

/**
 * Bloxity textures are authored unflipped and pixel-art filtered.
 *
 * They are also sRGB images. A plain TextureLoader leaves them tagged as linear, which
 * makes three skip the sRGB decode and the avatar renders pale and washed out.
 */
export function configureAvatarTexture(texture) {
  if (!texture) return texture
  texture.colorSpace = SRGBColorSpace
  texture.flipY = false
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.needsUpdate = true
  return texture
}

/**
 * Applies the skin texture to every skinned mesh of the base body.
 * The base body ships with an empty texture, so this always runs - with skin "0"
 * standing in when nothing is equipped.
 */
export function applySkin(rig, texture) {
  if (!texture) return
  for (const mesh of rig.skinnedMeshes) {
    if (!mesh.material) continue
    mesh.material.map = texture
    mesh.material.needsUpdate = true
  }
}

/**
 * Swaps a body part's geometry onto its base skinned mesh.
 *
 * A part GLB carries its own skeleton whose bone *order* may differ from the base
 * rig's. Its `skinIndex` attribute therefore has to be remapped by bone name, or the
 * limb deforms against the wrong bones.
 *
 * @param {object} rig from `collectRig`
 * @param {string} slot key of PART_SLOTS
 * @param {import('three').Object3D|null} partScene loaded GLB scene, or null to reset
 */
export function applyPart(rig, slot, partScene) {
  const targetMesh = rig.partMeshes[slot]
  if (!targetMesh) return

  // Unequipped / failed download: restore the part baked into player.glb.
  if (!partScene) {
    const original = rig.originalGeometries[slot]
    if (original && targetMesh.geometry !== original) targetMesh.geometry = original
    return
  }

  let skinnedSource = null
  let plainSource = null
  partScene.traverse((node) => {
    if (node.isSkinnedMesh && !skinnedSource) skinnedSource = node
    else if (node.isMesh && !plainSource) plainSource = node
  })

  if (!skinnedSource) {
    // Some parts ship as plain meshes; use them as-is.
    if (plainSource) targetMesh.geometry = plainSource.geometry
    return
  }

  const baseSkeleton = rig.skeleton
  if (!baseSkeleton || !skinnedSource.skeleton) {
    targetMesh.geometry = skinnedSource.geometry
    return
  }

  const geometry = skinnedSource.geometry.clone()

  const baseIndexByName = new Map()
  baseSkeleton.bones.forEach((bone, i) => baseIndexByName.set(bone.name, i))

  const remap = new Map()
  skinnedSource.skeleton.bones.forEach((bone, i) => {
    const baseIndex = baseIndexByName.get(bone.name)
    if (baseIndex !== undefined) remap.set(i, baseIndex)
  })

  const skinIndex = geometry.getAttribute('skinIndex')
  if (skinIndex) {
    const array = skinIndex.array
    for (let i = 0; i < array.length; i += 1) {
      const mapped = remap.get(array[i])
      if (mapped !== undefined) array[i] = mapped
    }
    skinIndex.needsUpdate = true
  }

  targetMesh.geometry = geometry
}

/**
 * Attaches a head (hat, hair, mask) or back accessory to its bone.
 * Offsets are the SDK's own: head items sit at y=0.8 on `Neck1`, back items at the
 * origin of `Spine2`.
 */
export function attachAccessory(rig, kind, object) {
  const head = kind !== 'back'
  const bone = head ? rig.hatBone : rig.backBone
  if (!object || !bone) return null

  object.scale.setScalar(1)
  object.position.set(0, head ? 0.8 : 0, 0)
  object.traverse((child) => {
    if (child.isMesh) child.castShadow = true
  })

  bone.add(object)
  return object
}

/**
 * Applies Bloxity body proportions.
 *
 * Must run every frame: each bone is reset to its rest transform before the
 * multipliers are re-applied, which is what makes the result idempotent and lets
 * proportion changes take effect live.
 *
 * `height`, `armLength`, `headScale` and `neckHeight` are applied exactly as the
 * Bloxity portal does, so the in-game body matches the preview. The remaining three
 * (`shoulderWidth`, `torsoScaleX`, `legOffsetX`) are not implemented in the SDK's
 * preview renderer; they are applied here in the spirit of their names and are the
 * ones to sanity-check against the portal.
 */
export function applyProportions(rig, proportions) {
  const skeleton = rig.skeleton
  if (!skeleton || !proportions) return

  const height = proportions.height ?? 1
  const armLength = proportions.armLength ?? 1
  const headScale = proportions.headScale ?? 1
  const neckHeight = proportions.neckHeight ?? 1
  const shoulderWidth = proportions.shoulderWidth ?? 1
  const torsoScaleX = proportions.torsoScaleX ?? 1
  const legOffsetX = proportions.legOffsetX ?? 1

  // Overall height is a scale on the character root, not on a bone.
  rig.root.scale.set(1, height, 1)

  for (const bone of skeleton.bones) {
    const rest = rig.bones[bone.name]
    if (!rest) continue

    const { origScale, origPos, origQuat } = rest
    bone.position.copy(origPos)
    bone.quaternion.copy(origQuat)
    bone.scale.copy(origScale)

    const name = bone.name

    if (name.startsWith('Arm')) {
      bone.scale.y = origScale.y * armLength
      // Not in the SDK preview: widen the shoulders by pushing the arm roots out.
      if (name === 'ArmL_Offset' || name === 'ArmR_Offset') {
        bone.position.x = origPos.x * shoulderWidth
      }
    } else if (name === NECK_OFFSET_BONE) {
      // Keeps the head sitting on the neck as height/headScale change, then applies
      // neckHeight against the bind-pose offset.
      bone.position.y += (height - headScale) * origPos.y
      bone.position.y += rig.neckOffsetBindY * (neckHeight - 1) * 0.8
    } else if (name === HAT_BONE) {
      // Divided by height so the head stays uniform inside the stretched root.
      bone.scale.set(
        origScale.x * headScale,
        origScale.y * (headScale / height),
        origScale.z * headScale,
      )
    } else if (name === BACK_BONE) {
      // Not in the SDK preview: torso width.
      bone.scale.x = origScale.x * torsoScaleX
    } else if (name === 'LegL_Offset' || name === 'LegR_Offset') {
      // Not in the SDK preview: leg splay, mirrored about the rig centre.
      bone.position.x = origPos.x * legOffsetX
    }
  }
}

/* ---------------------------------------------------------------------------
 * Procedural animation
 *
 * player.glb ships zero animation clips, so a walk/run/jump cycle has to be
 * driven directly on the bones. Rotations are *multiplied onto* whatever
 * applyProportions() just wrote, so this must run immediately after it in the
 * same frame - proportions reset each bone to its rest pose, which is exactly
 * the clean base a pose needs.
 * ------------------------------------------------------------------------- */

const _animQ = new Quaternion()

/**
 * Rotates a bone about one of its precomputed character-space axes.
 * `which` is 'axisX' (forward/back swing), 'axisZ' (lateral sway) or 'axisY' (twist).
 */
function rotateBone(rig, name, which, angle) {
  if (!angle) return
  const entry = rig.bones[name]
  const axis = entry?.[which]
  if (!axis) return
  entry.bone.quaternion.multiply(_animQ.setFromAxisAngle(axis, angle))
}

/** Swing a limb forward/back - the plane a walk cycle actually moves in. */
const swing = (rig, name, angle) => rotateBone(rig, name, 'axisX', angle)
/** Sway a limb out to the side. */
const sway = (rig, name, angle) => rotateBone(rig, name, 'axisZ', angle)
/** Twist a bone round the character's vertical axis. */
const twist = (rig, name, angle) => rotateBone(rig, name, 'axisY', angle)

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Feeds turning into the walk cycle: turning on the spot (or sharply while walking
 * slowly) steps the feet like a short walk, instead of the body sliding round. Call
 * once per frame with the character's facing; returns the speed to animate with.
 *
 * @param {{ prevRy?: number, turn?: number }} motion keeps its own state on this object
 */
export function turnAwareSpeed(motion, ry, speed, maxSpeed, dt) {
  let d = ry - (motion.prevRy ?? ry)
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  motion.prevRy = ry
  const rate = dt > 0 ? Math.abs(d) / dt : 0
  motion.turn = (motion.turn || 0) + (rate - (motion.turn || 0)) * Math.min(1, dt * 12)
  return motion.turn > 0.5 ? Math.max(speed, Math.min(maxSpeed * 0.45, motion.turn * 2.2)) : speed
}

/**
 * This game's body shape, multiplied onto each player's own Bloxity proportions:
 * broader shoulders, a slightly bigger head and a wider, sturdier stance - a spinner
 * champion's build, while everyone still looks like their own avatar.
 */
export const GAME_BODY = { shoulderWidth: 1.12, torsoScaleX: 1.06, headScale: 1.1, armLength: 0.97, legOffsetX: 1.14 }

/** `proportions` with GAME_BODY applied (a new object; inputs are not touched). */
export function gameProportions(proportions = {}) {
  const out = { ...proportions }
  for (const [key, k] of Object.entries(GAME_BODY)) out[key] = (proportions[key] ?? 1) * k
  return out
}

/** 1 between `a` and `b`, easing in and out over `ramp` seconds at each end. */
const envelope = (x, a, b, ramp) => smoothstep(a, a + ramp, x) * (1 - smoothstep(b - ramp, b, x))

/** How long a victory or defeat emote plays, in seconds (moving away ends it early). */
export const EMOTE_SECONDS = 3.6

/**
 * Victory: hop up and down with both fists pumping above the head.
 * Defeat: drop to the knees, slump forward and pound the ground with both fists.
 * `t` is seconds since the emote began.
 */
function poseEmote(rig, emote, t) {
  const w = smoothstep(0, 0.25, t)
  let lift

  if (emote === 'cheer') {
    const hop = (t % 0.62) / 0.62
    const height = 4 * hop * (1 - hop)
    // Squat a little at each take-off and landing; tuck the legs at the top.
    const squat = Math.max(0, 1 - Math.min(hop, 1 - hop) / 0.14)
    lift = (height * 1.5 - squat * 0.3) * w
    swing(rig, 'LegL1', (-0.5 * height - 0.35 * squat) * w)
    swing(rig, 'LegR1', (-0.5 * height - 0.35 * squat) * w)
    swing(rig, 'LegL2', (0.85 * height + 0.6 * squat) * w)
    swing(rig, 'LegR2', (0.85 * height + 0.6 * squat) * w)
    // Arms straight up in a V, fists pumping in turn. (The tilt is applied before the
    // swing, and a swing past vertical mirrors it: inward here ends up as a V overhead.)
    const pump = Math.sin(t * 13)
    swing(rig, 'ArmL1', (-2.75 - pump * 0.22) * w)
    swing(rig, 'ArmR1', (-2.75 + pump * 0.22) * w)
    sway(rig, 'ArmL1', 0.42 * w)
    sway(rig, 'ArmR1', -0.42 * w)
    swing(rig, 'Spine1', 0.12 * w)
    swing(rig, 'Neck1', 0.28 * w)
  } else {
    // Down on both knees: shins fold back flat, so the body drops one shin's length.
    const kneel = smoothstep(0, 0.45, t)
    lift = -1.2 * kneel
    swing(rig, 'LegL2', 1.55 * kneel)
    swing(rig, 'LegR2', 1.55 * kneel)
    swing(rig, 'Spine1', -0.55 * kneel)
    swing(rig, 'Neck1', -0.35 * kneel)
    // Then the fists: each rises slowly and slams down, the two taking turns.
    const pounding = smoothstep(0.35, 0.6, t)
    const fist = (u) => {
      const k = u % 1
      if (k < 0.55) return smoothstep(0, 0.55, k)
      if (k < 0.68) return 1 - smoothstep(0.55, 0.68, k)
      return 0
    }
    const beat = t * 2.6
    const left = fist(beat)
    const right = fist(beat + 0.5)
    swing(rig, 'ArmL1', (-0.5 - 1.25 * left * pounding) * kneel)
    swing(rig, 'ArmR1', (-0.5 - 1.25 * right * pounding) * kneel)
    sway(rig, 'ArmL1', -0.12 * kneel)
    sway(rig, 'ArmR1', 0.12 * kneel)
    // A small jolt through the body on every slam.
    const slam = Math.max(0, 1 - Math.abs((beat % 0.5) - 0.34) / 0.05)
    lift -= 0.07 * slam * pounding
  }
  rig.root.position.y = rig.rootRestY + lift
}

/**
 * Poses the rig for the current motion state.
 *
 * Everything eases rather than switching: the walk cycle's weight follows the speed
 * over about a tenth of a second, and its phase is integrated (frequency x time-step),
 * so starting, stopping and changing speed never jump the legs to a new position.
 *
 * @param {object} rig from `collectRig`
 * @param {{ time: number, speed: number, grounded: boolean, maxSpeed: number,
 *           emote?: 'cheer'|'defeat'|null, emoteStart?: number }} motion
 *   `speed` is horizontal speed in world units/sec; `maxSpeed` is what counts as a
 *   full-amplitude run, so the cycle scales smoothly from a walk to a sprint.
 */
export function animateRig(rig, motion) {
  if (!rig?.skeleton || !motion) return

  const { time = 0, speed = 0, grounded = true, maxSpeed = 6, emote = null, emoteStart = 0 } = motion
  const st = rig.anim || (rig.anim = { last: time, phase: 0, gait: 0, air: 0, land: -10, idleT: 0 })
  const dt = Math.min(0.1, Math.max(0, time - st.last))
  st.last = time
  rig.root.position.y = rig.rootRestY

  if (emote) {
    poseEmote(rig, emote, time - emoteStart)
    return
  }

  // --- Eased state ----------------------------------------------------------
  const target = Math.min(speed / Math.max(maxSpeed, 0.001), 1)
  st.gait += (target - st.gait) * Math.min(1, dt * 9)
  if (st.air > 0.6 && grounded) st.land = time
  st.air += ((grounded ? 0 : 1) - st.air) * Math.min(1, dt * (grounded ? 16 : 10))
  st.phase += dt * (5.5 + st.gait * 5)
  st.idleT = st.gait < 0.05 && st.air < 0.1 ? st.idleT + dt : 0

  const g = st.gait
  const ground = 1 - st.air
  const walk = smoothstep(0.03, 0.2, g) * ground
  const idle = (1 - smoothstep(0.03, 0.2, g)) * ground
  // A real stride even when walking slowly, growing to full length at a sprint.
  const stride = 0.45 + 0.55 * g
  const cycle = Math.sin(st.phase)
  const step = Math.cos(st.phase)
  let lift = 0

  // --- Standing: a ready stance, breathing, then little fidgets ---------------
  if (idle > 0.001) {
    const breathe = Math.sin(time * 1.7)
    const shift = Math.sin(time * 0.8)
    // Feet apart, chest up, arms a little out and forward.
    sway(rig, 'LegL1', -0.06 * idle)
    sway(rig, 'LegR1', 0.06 * idle)
    swing(rig, 'Spine1', (0.04 + breathe * 0.015) * idle)
    sway(rig, 'Spine1', shift * 0.035 * idle)
    sway(rig, 'ArmL1', (-0.14 - breathe * 0.03) * idle)
    sway(rig, 'ArmR1', (0.14 + breathe * 0.03) * idle)
    swing(rig, 'ArmL1', -0.07 * idle)
    swing(rig, 'ArmR1', -0.07 * idle)
    lift += breathe * 0.025 * idle

    // Standing still a while: look around, then rip a launcher cord like a real
    // spinner battler - left hand holds the launcher out, right hand yanks back.
    const it = st.idleT % 12
    const look = envelope(it, 4, 6.6, 0.5)
    if (look > 0) twist(rig, 'Neck1', Math.sin(((it - 4) / 2.6) * Math.PI * 2) * 0.55 * look * idle)
    const rip = envelope(it, 9, 10.6, 0.25)
    if (rip > 0) {
      const pull = smoothstep(0.42, 0.56, (it - 9) / 1.6)
      swing(rig, 'ArmL1', -1.25 * rip * idle)
      swing(rig, 'ArmR1', (-1.3 + 1.9 * pull) * rip * idle)
      swing(rig, 'ArmR2', -0.8 * (1 - pull) * rip * idle)
      twist(rig, 'Spine2', (-0.25 + 0.5 * pull) * rip * idle)
    }
  }

  // --- Walk / run -----------------------------------------------------------
  if (walk > 0.001) {
    const legAmp = 0.8 * stride * walk
    const armAmp = 0.65 * stride * walk
    // Legs swing in opposition; knees fold on the backswing.
    swing(rig, 'LegL1', cycle * legAmp)
    swing(rig, 'LegR1', -cycle * legAmp)
    swing(rig, 'LegL2', Math.max(0, -cycle) * 1.15 * stride * walk)
    swing(rig, 'LegR2', Math.max(0, cycle) * 1.15 * stride * walk)
    // Arms counter-swing, a little out from the body, elbows bending more at speed.
    swing(rig, 'ArmL1', -cycle * armAmp)
    swing(rig, 'ArmR1', cycle * armAmp)
    sway(rig, 'ArmL1', -0.07 * walk)
    sway(rig, 'ArmR1', 0.07 * walk)
    swing(rig, 'ArmL2', (Math.max(0, cycle) * 0.45 + 0.25 * g) * stride * walk)
    swing(rig, 'ArmR2', (Math.max(0, -cycle) * 0.45 + 0.25 * g) * stride * walk)
    // Shoulders twist against the hips, the body rolls over each foot, leans into
    // the run, and the head stays steady.
    twist(rig, 'Spine2', -cycle * 0.14 * stride * walk)
    sway(rig, 'Spine1', step * 0.035 * walk)
    swing(rig, 'Spine1', -0.16 * g * walk)
    swing(rig, 'Neck1', 0.1 * g * walk)
    // Highest as each leg passes under the body: twice per cycle.
    lift += (0.5 + 0.5 * Math.cos(st.phase * 2)) * 0.2 * stride * walk
  }

  // --- Airborne: tuck the legs, throw the arms up ---------------------------
  if (st.air > 0.001) {
    const a = st.air
    swing(rig, 'LegL1', -0.55 * a)
    swing(rig, 'LegL2', 0.75 * a)
    swing(rig, 'LegR1', 0.3 * a)
    swing(rig, 'LegR2', 0.2 * a)
    swing(rig, 'ArmL1', -2.1 * a)
    swing(rig, 'ArmR1', -2.1 * a)
    swing(rig, 'Spine1', -0.1 * a)
  }

  // --- Landing: a quick squash through the knees ----------------------------
  const sinceLand = time - st.land
  if (sinceLand < 0.24) {
    const k = Math.sin((sinceLand / 0.24) * Math.PI)
    swing(rig, 'LegL1', -0.35 * k)
    swing(rig, 'LegR1', -0.35 * k)
    swing(rig, 'LegL2', 0.6 * k)
    swing(rig, 'LegR2', 0.6 * k)
    swing(rig, 'Spine1', -0.12 * k)
    lift -= 0.28 * k
  }

  rig.root.position.y = rig.rootRestY + lift
}

/** Moods for poseChampion. */
export const MOOD = { idle: 0, cheer: 1, beaten: 2, victory: 3 }

/**
 * Poses a stage champion standing on their red pad. Like animateRig, it multiplies onto
 * the rest pose, so applyProportions must run first in the same frame.
 *
 *  idle    - hands on hips, a fist pump every few seconds
 *  cheer   - both fists pumping while their spinners fight
 *  beaten  - slumped forward, head down, arms hanging
 *  victory - arms high, bouncing
 */
export function poseChampion(rig, time, mood) {
  if (!rig?.skeleton) return
  rig.root.position.y = rig.rootRestY

  if (mood === MOOD.cheer || mood === MOOD.victory) {
    const fast = mood === MOOD.victory ? 9 : 7
    const a = Math.sin(time * fast)
    swing(rig, 'ArmL1', -2.6 - a * 0.3)
    swing(rig, 'ArmR1', -2.6 + a * 0.3)
    // Mirrored by the swing past vertical: this opens the arms into a V overhead.
    sway(rig, 'ArmL1', 0.35)
    sway(rig, 'ArmR1', -0.35)
    swing(rig, 'Spine1', 0.08)
    rig.root.position.y = rig.rootRestY + Math.abs(Math.sin(time * fast)) * (mood === MOOD.victory ? 0.6 : 0.25)
    return
  }

  if (mood === MOOD.beaten) {
    swing(rig, 'Spine1', -0.35)
    swing(rig, 'Neck1', -0.45)
    sway(rig, 'ArmL1', -0.04)
    sway(rig, 'ArmR1', 0.04)
    swing(rig, 'ArmL1', 0.25)
    swing(rig, 'ArmR1', 0.25)
    return
  }

  // Idle: hands on hips; every 4s the right fist goes up and pumps twice.
  const breathe = Math.sin(time * 1.8)
  sway(rig, 'ArmL1', -0.55 - breathe * 0.03)
  sway(rig, 'ArmL2', 1.25)
  swing(rig, 'Spine1', 0.06 + breathe * 0.015)
  swing(rig, 'Neck1', 0.08)
  const t = time % 4
  if (t > 2.6) {
    const up = Math.min(1, (t - 2.6) * 6) * Math.min(1, (4 - t) * 6)
    const pump = Math.sin((t - 2.6) * 14) * 0.25
    swing(rig, 'ArmR1', (-2.6 + pump) * up)
    swing(rig, 'ArmR2', -0.7 * up)
    sway(rig, 'ArmR1', 0.55 * (1 - up) + 0.15 * up)
    sway(rig, 'ArmR2', -1.25 * (1 - up))
  } else {
    sway(rig, 'ArmR1', 0.55 + breathe * 0.03)
    sway(rig, 'ArmR2', -1.25)
  }
  rig.root.position.y = rig.rootRestY + breathe * 0.04
}
