import { useRef } from 'react'

import { GRAVITY, JUMP_SPEED, PLAYER_RADIUS, STAGE, WALK_SPEED, WORLDS, gateFront, worldOfZone } from '@shared'

import { sfx } from '../audio/sfx'
import { live } from '../store/live'
import { groundAt, resolveSolids, solidTopAt } from './collision'
import { ORDER, useSystem } from './loop'
import PlayerAvatar from './PlayerAvatar'

const PLAYER_HEIGHT = 1.8
const SPRINT_MULTIPLIER = 1.3
const FALL_LIMIT = -40

/** Shortest-path angle lerp. */
function lerpAngle(a, b, t) {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

function respawn(p) {
  // Back in front of the next gate of the current run, else at the spawn.
  const world = worldOfZone(live.zone)
  const run = live.run && live.run.world === world ? live.run : null
  const spot = run && run.cleared > 0 ? gateFront(Math.min(run.cleared + 1, WORLDS[world].stageCount)) : STAGE.spawn
  p.x = spot.x
  p.y = spot.y + 2
  p.z = spot.z
  p.vx = 0
  p.vy = 0
  p.vz = 0
  p.warp += 1
}

/**
 * The player: a kinematic character (no physics engine) wearing the Bloxity avatar.
 *
 * Movement is camera-relative, like the template's Rapier version, but resolved
 * against the tiny collision world in collision.js: walk on floors, slide along walls
 * and arena rims, jump onto boxes, respawn when falling off the island.
 *
 * @param {{ onAvatarReady?: () => void, onAvatarMounted?: () => void }} props
 */
export function LocalPlayer({ onAvatarReady, onAvatarMounted }) {
  const groupRef = useRef(null)
  const visualRef = useRef(null)

  /**
   * Motion state handed to the avatar so it can pose itself. A ref, not state:
   * this is written every frame and must not trigger a re-render.
   */
  const motionRef = useRef({ time: 0, speed: 0, grounded: true, maxSpeed: WALK_SPEED })

  useSystem(ORDER.player, (dt) => {
    const p = live.player
    const input = live.input
    const frozen = Boolean(live.battle) || p.frozen

    // --- Input -> wish direction, relative to the camera's yaw ------------------
    let ix = (input.right ? 1 : 0) - (input.left ? 1 : 0) + input.joyX
    let iz = (input.forward ? 1 : 0) - (input.backward ? 1 : 0) + input.joyY
    const len = Math.hypot(ix, iz)
    if (len > 1) {
      ix /= len
      iz /= len
    }
    if (frozen) {
      ix = 0
      iz = 0
    }
    // The camera sits at +(sin yaw, cos yaw) from the player, so "forward" is the
    // opposite direction and "right" is that rotated a quarter turn.
    const sin = Math.sin(live.camera.yaw)
    const cos = Math.cos(live.camera.yaw)
    const wx = -sin * iz + cos * ix
    const wz = -cos * iz - sin * ix

    const speed = WALK_SPEED * p.speedMult * (input.sprint ? SPRINT_MULTIPLIER : 1)
    const k = Math.min(1, dt * 12)
    p.vx += (wx * speed - p.vx) * k
    p.vz += (wz * speed - p.vz) * k

    // --- Jump + gravity ----------------------------------------------------------
    if (input.jump && p.grounded && !frozen) {
      p.vy = JUMP_SPEED
      p.grounded = false
      sfx.jump()
    }
    p.vy -= GRAVITY * dt

    p.x += p.vx * dt
    p.z += p.vz * dt
    p.y += p.vy * dt

    resolveSolids(p, PLAYER_RADIUS, PLAYER_HEIGHT)
    const ground = Math.max(groundAt(p.x, p.z, p.y), solidTopAt(p.x, p.z, p.y, PLAYER_RADIUS))
    if (p.y <= ground) {
      p.y = ground
      p.vy = 0
      p.grounded = true
    } else if (p.y > ground + 0.08) {
      p.grounded = false
    }
    if (p.y < FALL_LIMIT) respawn(p)

    // --- Facing + pose ------------------------------------------------------------
    const horizontal = Math.hypot(p.vx, p.vz)
    if (horizontal > 0.6) {
      p.ry = lerpAngle(p.ry, Math.atan2(p.vx, p.vz), 1 - Math.pow(0.0005, dt))
    } else if (live.battle) {
      // Face the arena while our spinners fight.
      const b = live.battle
      p.ry = lerpAngle(p.ry, Math.atan2(b.cx - p.x, b.cz - p.z), 1 - Math.pow(0.01, dt))
    }
    p.speed = horizontal
    p.anim = !p.grounded ? 2 : horizontal > 0.6 ? 1 : 0
    p.airTime = p.grounded ? 0 : p.airTime + dt

    const group = groupRef.current
    if (group) group.position.set(p.x, p.y, p.z)
    if (visualRef.current) visualRef.current.rotation.y = p.ry

    const motion = motionRef.current
    motion.time += dt
    motion.speed = horizontal
    motion.grounded = p.grounded
    motion.maxSpeed = speed
  })

  return (
    <group ref={groupRef}>
      <group ref={visualRef}>
        <PlayerAvatar onReady={onAvatarReady} onMounted={onAvatarMounted} targetHeight={PLAYER_HEIGHT} motionRef={motionRef} />
      </group>
    </group>
  )
}

export default LocalPlayer
