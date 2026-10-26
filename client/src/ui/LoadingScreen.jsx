import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'

import { useGameStore } from '../store/gameStore'

const TIPS = [
  'Stand next to a training ring and click to gain power!',
  'Every 5 levels you can equip another spinner.',
  'Rebirth to multiply all the power you train!',
  'Collect 5 of the same spinner to craft a Golden one.',
  'Grab pumpkins around the lobby for Halloween candy!',
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

  return (
    <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-linear-to-b from-sky-400 to-blue-700 transition-opacity duration-500 ${done ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
      <div className="anim-bob text-8xl drop-shadow-[0_8px_0_rgba(0,0,0,0.3)]">🌀</div>
      <h1 className="stroke mt-2 text-center text-5xl sm:text-7xl">
        <span className="text-yellow-300">+1</span> SPINNER
        <br />
        EVOLUTION
      </h1>
      <div className="mt-8 h-7 w-[min(80vw,420px)] overflow-hidden rounded-full border-4 border-black/70 bg-black/30">
        <div className="h-full bg-linear-to-b from-yellow-300 to-orange-500 transition-[width] duration-300" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="stroke mt-2 text-xl">{label}</div>
      {status === 'error' && error && <div className="stroke-sm mt-1 max-w-sm text-center text-sm text-red-200">{error}</div>}
      <div className="stroke-sm absolute bottom-6 max-w-md px-4 text-center text-lg text-white/90">💡 {tip}</div>
      {/* Rasterise the emoji used in battle now, so the first hit doesn't stutter. */}
      <div aria-hidden className="pointer-events-none absolute left-0 top-0 opacity-0">💀👑💥⭐🏆🍬✨🎁🔒</div>
    </div>
  )
}
