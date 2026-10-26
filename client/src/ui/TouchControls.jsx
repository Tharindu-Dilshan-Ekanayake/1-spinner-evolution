import { useEffect, useRef, useState } from 'react'

import { C2S } from '@shared'

import { sfx } from '../audio/sfx'
import { send } from '../net/connection'
import { useGameStore } from '../store/gameStore'
import { live } from '../store/live'
import { isMobile } from '../store/qualityStore'

const RADIUS = 56

/**
 * Mobile controls: a floating joystick (left half of the screen), a jump button and,
 * while training or fighting, a big BOOST button. Written straight into live.input -
 * no React state per touch move.
 */
export default function TouchControls() {
  const [enabled, setEnabled] = useState(() => isMobile() || 'ontouchstart' in window)
  const battle = useGameStore((s) => s.battle)
  const ring = useGameStore((s) => s.nearby.ring)
  const baseRef = useRef(null)
  const knobRef = useRef(null)
  const touchId = useRef(null)
  const origin = useRef({ x: 0, y: 0 })

  // A first real touch turns the controls on (e.g. a touchscreen laptop).
  useEffect(() => {
    if (enabled) return undefined
    const on = () => setEnabled(true)
    window.addEventListener('touchstart', on, { once: true })
    return () => window.removeEventListener('touchstart', on)
  }, [enabled])

  if (!enabled) return null

  const move = (x, y) => {
    let dx = x - origin.current.x
    let dy = y - origin.current.y
    const d = Math.hypot(dx, dy)
    if (d > RADIUS) {
      dx = (dx / d) * RADIUS
      dy = (dy / d) * RADIUS
    }
    live.input.joyX = dx / RADIUS
    live.input.joyY = -dy / RADIUS
    if (knobRef.current) knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`
  }

  const onStart = (e) => {
    const t = e.changedTouches[0]
    touchId.current = t.identifier
    origin.current = { x: t.clientX, y: t.clientY }
    if (baseRef.current) {
      baseRef.current.style.left = `${t.clientX - RADIUS}px`
      baseRef.current.style.top = `${t.clientY - RADIUS}px`
      baseRef.current.style.opacity = '1'
    }
    move(t.clientX, t.clientY)
  }
  const onMove = (e) => {
    for (const t of e.changedTouches) if (t.identifier === touchId.current) move(t.clientX, t.clientY)
  }
  const onEnd = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== touchId.current) continue
      touchId.current = null
      live.input.joyX = 0
      live.input.joyY = 0
      if (knobRef.current) knobRef.current.style.transform = 'translate(0px, 0px)'
      if (baseRef.current) baseRef.current.style.opacity = '0.45'
    }
  }

  const boost = (e) => {
    e.preventDefault()
    send(C2S.click)
    sfx.click()
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-[15]">
      {/* Left half: joystick zone (below the HUD tiles). */}
      {!battle && (
        <div className="pointer-events-auto absolute bottom-0 left-0 h-[45%] w-1/2" onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} onTouchCancel={onEnd}>
          <div ref={baseRef} className="absolute h-28 w-28 rounded-full border-4 border-white/50 bg-black/25 opacity-45" style={{ left: 40, bottom: 60 }}>
            <div ref={knobRef} className="absolute left-1/2 top-1/2 -ml-7 -mt-7 h-14 w-14 rounded-full border-4 border-white/70 bg-white/40" />
          </div>
        </div>
      )}
      {!battle && (
        <button
          type="button"
          className="gbtn g-blue stroke pointer-events-auto absolute bottom-24 right-4 h-20 w-20 rounded-full text-lg"
          onTouchStart={(e) => {
            e.preventDefault()
            live.input.jump = true
          }}
          onTouchEnd={() => {
            live.input.jump = false
          }}
        >
          JUMP
        </button>
      )}
      {(battle || ring) && (
        <button type="button" className="gbtn g-orange stroke pointer-events-auto absolute bottom-48 right-4 h-24 w-24 rounded-full text-xl anim-glow" onTouchStart={boost}>
          {battle ? 'BOOST!' : 'TRAIN!'}
        </button>
      )}
    </div>
  )
}
