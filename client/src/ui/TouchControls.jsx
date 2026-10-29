import { useEffect, useRef, useState } from 'react'

import { C2S } from '@shared'

import { sfx } from '../audio/sfx'
import { send } from '../net/connection'
import { useGameStore } from '../store/gameStore'
import { live } from '../store/live'
import { isMobile } from '../store/qualityStore'
import Icon from './kit/Icon'
import { ChunkyButton } from './kit/parts'
import StrokeText from './kit/StrokeText'
import { GRADIENTS, u } from './kit/style'
import { useHudMode } from './kit/layout'

/**
 * Where the jump and TRAIN/BOOST buttons sit (reference px): bottom-right like the slide
 * game, and above the level bar in portrait, where it spans the whole width.
 */
const BUTTONS = {
  wide: { bottom: 34, right: 34 },
  short: { bottom: 30, right: 32 },
  tall: { bottom: 290, right: 28 },
}

/** The slide game's jump button face: a white chevron with a dark outline. */
function JumpArrow() {
  return (
    <svg viewBox="0 0 100 100" style={{ width: '62%', height: '62%' }} aria-hidden="true">
      <path d="M22 64L50 36l28 28" fill="none" stroke="#111" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 64L50 36l28 28" fill="none" stroke="#fff" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const RADIUS = 56

/**
 * Mobile controls: a floating joystick (left half of the screen), a jump button and,
 * while training or fighting, a big BOOST button. Written straight into live.input -
 * no React state per touch move.
 */
export default function TouchControls() {
  const [enabled, setEnabled] = useState(() => isMobile() || 'ontouchstart' in window)
  const mode = useHudMode()
  const battle = useGameStore((s) => s.battle)
  // A panel covers the game: the controls get out of the way (and can't be tapped).
  const panelOpen = useGameStore((s) => s.panel !== null)
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
    <div className="pointer-events-none absolute inset-0 z-[15]" style={panelOpen ? { visibility: 'hidden' } : undefined}>
      {/* Left half: joystick zone (below the HUD tiles). */}
      {!battle && (
        <div className="pointer-events-auto absolute bottom-0 left-0 h-[45%] w-1/2" onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} onTouchCancel={onEnd}>
          <div ref={baseRef} className="absolute h-28 w-28 rounded-full border-4 border-white/50 bg-black/25 opacity-45" style={{ left: 24, bottom: mode === 'tall' ? u(270) : 8 }}>
            <div ref={knobRef} className="absolute left-1/2 top-1/2 -ml-7 -mt-7 h-14 w-14 rounded-full border-4 border-white/70 bg-white/40" />
          </div>
        </div>
      )}
      {!battle && (
        <ChunkyButton
          gradient={GRADIENTS.slate}
          quiet
          radius={90}
          border={5}
          title="Jump"
          className="absolute"
          style={{ right: u(BUTTONS[mode].right), bottom: u(BUTTONS[mode].bottom), width: u(165), height: u(165) }}
          onTouchStart={(e) => {
            e.preventDefault()
            live.input.jump = true
          }}
          onTouchEnd={() => {
            live.input.jump = false
          }}
        >
          <JumpArrow />
        </ChunkyButton>
      )}
      {(battle || ring) && (
        // Gold, with its icon over the word, like Muscle to Push Boulder's LIFT button.
        <ChunkyButton
          gradient={GRADIENTS.goldButton}
          quiet
          radius={90}
          border={5}
          className="pp-pulse absolute flex-col"
          style={{ right: u(BUTTONS[mode].right + (battle ? 0 : 190)), bottom: u(BUTTONS[mode].bottom), width: u(170), height: u(170) }}
          onTouchStart={boost}
        >
          <Icon name={battle ? 'spinner' : 'muscle'} size={u(92)} style={{ marginTop: u(-8) }} />
          <span style={{ fontSize: u(32), marginTop: u(-10) }}>
            <StrokeText stroke={u(7)}>{battle ? 'BOOST' : 'TRAIN'}</StrokeText>
          </span>
        </ChunkyButton>
      )}
    </div>
  )
}
