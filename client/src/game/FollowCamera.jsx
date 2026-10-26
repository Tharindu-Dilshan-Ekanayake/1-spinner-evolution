import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'

import { live } from '../store/live'
import { cameraClearance } from './collision'
import { ORDER, useSystem } from './loop'

/** How high above the player's origin the camera aims. */
const LOOK_HEIGHT = 1.6

const MIN_DISTANCE = 4
const MAX_DISTANCE = 30

// Pitch limits, in radians. Stops the camera flipping over the top or sinking
// under the ground.
const MIN_PITCH = -0.1
const MAX_PITCH = 1.3

const DRAG_SENSITIVITY = 0.006
const ZOOM_SENSITIVITY = 0.012
/** Pixels a press may move and still count as a click (training / battle boost). */
const CLICK_SLOP = 8

// Higher = snappier. Framerate-independent via the pow() smoothing below.
const POSITION_SMOOTHING = 6
const LOOK_SMOOTHING = 9

const _desired = new Vector3()
const _target = new Vector3()

/**
 * Third-person orbit camera, plus a fixed overhead view during battles.
 *
 * Desktop: drag (left or right button) orbits, the wheel zooms, a click without a
 * drag is a "tap" (boost while training or fighting). Touch: one finger orbits,
 * two fingers pinch-zoom, a quick tap is a tap. The joystick and HUD buttons sit
 * above the canvas, so their touches never reach this handler.
 *
 * @param {{ onTap: () => void }} props
 */
export function FollowCamera({ onTap }) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const lookAt = useRef(new Vector3())
  const initialised = useRef(false)
  const lastWarp = useRef(0)

  useEffect(() => {
    const el = gl.domElement
    if (!el) return undefined

    const pointers = new Map()
    let pinchStart = 0
    let pinchDistance = 0

    const onPointerDown = (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false })
      el.setPointerCapture?.(e.pointerId)
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinchStart = Math.hypot(a.x - b.x, a.y - b.y)
        pinchDistance = live.camera.distance
      }
    }

    const onPointerMove = (e) => {
      const p = pointers.get(e.pointerId)
      if (!p) return
      const dx = e.clientX - p.x
      const dy = e.clientY - p.y
      p.x = e.clientX
      p.y = e.clientY
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > CLICK_SLOP) p.moved = true

      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinchStart > 0) {
          live.camera.distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, pinchDistance * (pinchStart / d)))
        }
        return
      }
      if (!p.moved || live.camera.mode === 'battle') return
      const o = live.camera
      o.yaw -= dx * DRAG_SENSITIVITY
      o.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, o.pitch + dy * DRAG_SENSITIVITY))
    }

    const endPointer = (e) => {
      const p = pointers.get(e.pointerId)
      if (!p) return
      pointers.delete(e.pointerId)
      el.releasePointerCapture?.(e.pointerId)
      if (e.type === 'pointerup' && !p.moved && pointers.size === 0 && e.button !== 2) {
        onTap?.()
      }
    }

    const onWheel = (e) => {
      // Without this the page scrolls behind the canvas.
      e.preventDefault()
      const o = live.camera
      o.distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, o.distance + e.deltaY * ZOOM_SENSITIVITY))
    }

    // Right-dragging otherwise opens the browser context menu mid-orbit.
    const onContextMenu = (e) => e.preventDefault()

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', endPointer)
    el.addEventListener('pointercancel', endPointer)
    el.addEventListener('contextmenu', onContextMenu)
    // passive:false is required for preventDefault() on wheel to take effect.
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', endPointer)
      el.removeEventListener('pointercancel', endPointer)
      el.removeEventListener('contextmenu', onContextMenu)
      el.removeEventListener('wheel', onWheel)
    }
  }, [gl, onTap])

  useSystem(ORDER.camera, (delta) => {
    const b = live.battle
    const o = live.camera
    o.mode = b ? 'battle' : 'follow'

    if (b) {
      // Look down at the arena from the player's side, like the original.
      // From the side of the arena, like the original: the enemy's red pad on the
      // left of the screen, your blue pad on the right.
      _target.set(b.cx + 1, 0, b.cz)
      _desired.set(b.cx - 18, 17, b.cz)
    } else {
      const p = live.player
      _target.set(p.x, p.y + LOOK_HEIGHT, p.z)
      // Spherical -> cartesian. yaw 0 puts the camera behind the player on +Z.
      const cp = Math.cos(o.pitch)
      const dx = Math.sin(o.yaw) * cp
      const dy = Math.sin(o.pitch)
      const dz = Math.cos(o.yaw) * cp
      // Pull in when a wall is between the camera and the player.
      const distance = cameraClearance(_target.x, _target.y, _target.z, dx, dy, dz, o.distance)
      _desired.set(_target.x + dx * distance, _target.y + dy * distance, _target.z + dz * distance)
    }

    if (!initialised.current || lastWarp.current !== live.player.warp) {
      lastWarp.current = live.player.warp
      // Avoid a long swoop in from wherever the default camera started.
      camera.position.copy(_desired)
      lookAt.current.copy(_target)
      initialised.current = true
    }

    // 1 - pow(x, delta) keeps the easing rate consistent across framerates.
    const snap = b ? 0.6 : 1
    camera.position.lerp(_desired, 1 - Math.pow(0.001, delta * (POSITION_SMOOTHING / 10) * snap))
    lookAt.current.lerp(_target, 1 - Math.pow(0.001, delta * (LOOK_SMOOTHING / 10)))
    camera.lookAt(lookAt.current)
  })

  return null
}

export default FollowCamera
