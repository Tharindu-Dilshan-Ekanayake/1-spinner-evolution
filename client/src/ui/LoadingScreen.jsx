import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'

import { useGameStore } from '../store/gameStore'
import { iconUrl } from './kit/icons'
import StrokeText from './kit/StrokeText'

const TIPS = [
  'Stand next to a training ring and click to gain power!',
  'Every 5 levels you can equip another spinner.',
  'Rebirth to multiply all the power you train!',
  'Collect 5 of the same spinner to craft a Golden one.',
  'The yellow pad cashes out your stage run.',
]

/**
 * Covers the screen until the scene has drawn, the avatar is assembled and the
 * server has sent our save. Asset progress comes from drei's useProgress.
 */
export default function LoadingScreen({ sceneReady }) {
  const { progress, active } = useProgress()
  const status = useGameStore((s) => s.status)
  const profile = useGameStore((s) => s.profile)
  const error = useGameStore((s) => s.error)
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)])
  const [gone, setGone] = useState(false)

  const done = sceneReady && Boolean(profile)
  useEffect(() => {
    if (!done) return undefined
    const t = setTimeout(() => setGone(true), 600)
    return () => clearTimeout(t)
  }, [done])

  if (gone) return null

  const steps = [sceneReady || !active ? 1 : 0, status === 'online' ? 1 : 0, profile ? 1 : 0]
  const pct = Math.round(Math.max(progress * 0.6 + steps.reduce((a, b) => a + b, 0) * 13.3, 4))
  const label = !sceneReady ? 'Building the world…' : status !== 'online' ? (status === 'error' ? 'Server offline — retrying…' : 'Connecting to server…') : 'Loading your spinners…'

  const shown = Math.min(100, pct)

  return (
    <div
      className={`pp-font absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden px-4 transition-opacity duration-500 ${done ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      // Everything is sized by the smaller of the screen's width and height (vmin), so it
      // fits a phone upright, a phone on its side and a desktop window alike.
      style={{ gap: 'clamp(8px, 3vmin, 24px)', background: 'linear-gradient(180deg, #2f8ff2 0%, #6fc0fb 55%, #c6ec86 55.2%, #a9dd6a 100%)' }}
    >
      <div className="pp-loading-disc" aria-hidden="true">
        <img src={iconUrl('spinner')} alt="" draggable={false} style={{ width: 'clamp(64px, 20vmin, 150px)', height: 'clamp(64px, 20vmin, 150px)' }} />
      </div>
      {/* Own compositor layer: progress updates below never repaint this big title. */}
      {/* Two lines, so even a narrow phone fits it: "+1 SPINNER" over "EVOLUTION". */}
      <h1 className="m-0 flex flex-col items-center text-center leading-none" style={{ fontSize: 'clamp(30px, min(13vw, 15vh), 104px)', gap: '0.04em', transform: 'rotate(-3deg)', willChange: 'transform', maxWidth: '100%' }}>
        <StrokeText stroke="0.16em" gradient="linear-gradient(180deg, #ffffff 0%, #ffffff 55%, #ffe36b 56%, #ffb21e 100%)">
          +1 SPINNER
        </StrokeText>
        <StrokeText stroke="0.16em" gradient="linear-gradient(180deg, #ffffff 0%, #ffffff 55%, #ffe36b 56%, #ffb21e 100%)">
          EVOLUTION
        </StrokeText>
      </h1>
      <div className="w-[min(560px,88vw)]">
        <div className="relative h-9 overflow-hidden rounded-xl border-4 border-black bg-black/40">
          {/* scaleX, not width: the fill animates on the compositor, with no layout per frame. */}
          <div
            className="h-full origin-left rounded-md transition-transform duration-300"
            style={{ transform: `scaleX(${shown / 100})`, willChange: 'transform', background: 'linear-gradient(180deg, #fff27a 0%, #ffc61e 50%, #ff9a12 100%)' }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-lg">
            <StrokeText stroke={5}>{done ? 'READY!' : `LOADING ${shown}%`}</StrokeText>
          </div>
        </div>
        <p className="mt-2 text-center text-base sm:text-lg">
          <StrokeText stroke={5}>{label}</StrokeText>
        </p>
        {status === 'error' && error && <div className="stroke-sm mt-1 text-center text-sm text-red-200">{error}</div>}
        <p className="mt-1 text-center text-sm sm:text-base md:text-lg">
          <StrokeText stroke={4} className="whitespace-normal">
            {tip}
          </StrokeText>
        </p>
      </div>
      {/* Rasterise the emoji used in battle now, so the first hit doesn't stutter. */}
      <div aria-hidden className="pointer-events-none absolute left-0 top-0 opacity-0">💀👑💥⭐🏆✨🎁🔒</div>
    </div>
  )
}
