import { useEffect, useState } from 'react'

import { CAPSULES, RARITIES, SPINNERS, formatNumber } from '@shared'

import { sfx } from '../audio/sfx'
import { useGameStore } from '../store/gameStore'
import { RarityText, SpinnerIcon } from './common'

const SHAKE_MS = 1050
const SHOW_MS = 1700

function Capsule({ color }) {
  return (
    <div className="anim-wobble relative h-44 w-44">
      <div className="absolute inset-x-2 bottom-4 h-28 rounded-[50%] border-4 border-black/70" style={{ background: `radial-gradient(circle at 35% 30%, #ffffffaa, ${color} 45%, #00000066)` }} />
      <div className="absolute inset-x-0 bottom-14 h-4 rounded-full border-4 border-black/60 bg-yellow-300" />
      <div className="absolute inset-x-6 top-4 h-20 rounded-t-full border-4 border-black/70 bg-white/40" />
    </div>
  )
}

function Card({ result, delay }) {
  const def = SPINNERS[result.id]
  const rarity = RARITIES[def.rarity]
  return (
    <div className="anim-reveal relative flex w-40 flex-col items-center sm:w-48" style={{ animationDelay: `${delay}ms`, opacity: 0 }}>
      <div
        className="anim-rays absolute -top-6 h-56 w-56 rounded-full opacity-80"
        style={{ background: `repeating-conic-gradient(${rarity.rainbow ? '#ff4df0' : rarity.color}55 0deg 12deg, transparent 12deg 24deg)` }}
      />
      <div className="relative rounded-2xl border-4 border-black/70 p-2" style={{ background: `radial-gradient(circle, #ffffffcc, ${rarity.color}aa)` }}>
        <SpinnerIcon id={result.id} golden={result.golden} size={128} />
        {result.isNew && <span className="stroke absolute -right-3 -top-3 rotate-12 rounded-lg border-2 border-black/70 bg-red-500 px-2 text-lg">NEW!</span>}
      </div>
      <div className="stroke relative mt-1 text-center text-2xl leading-tight">
        {result.golden ? 'Golden ' : ''}
        {def.name}
      </div>
      <RarityText rarity={def.rarity} className="relative text-xl" />
      <div className="stroke-sm relative text-base">
        ⚔️ {formatNumber(def.dmg * (result.golden ? 2.5 : 1))} &nbsp;❤️ {formatNumber(def.hp * (result.golden ? 2.5 : 1))}
      </div>
    </div>
  )
}

/** Golden crafts, the Crystal Spinner and level-up gifts skip straight to the reveal. */
const isInstant = (opening) => opening.capsule === 'golden' || opening.capsule === 'crystal' || opening.capsule === 'gift'

/** One opening; remounted (fresh state) for every new capsule via its key. */
function Opening({ opening }) {
  const [phase, setPhase] = useState(() => (isInstant(opening) ? 'reveal' : 'shake'))

  useEffect(() => {
    const instant = isInstant(opening)
    const best = Math.max(...opening.results.map((r) => RARITIES[SPINNERS[r.id].rarity].order))
    let t1 = null
    if (instant) sfx.reveal(best)
    else {
      sfx.shake()
      t1 = setTimeout(() => {
        setPhase('reveal')
        sfx.reveal(best)
      }, SHAKE_MS)
    }
    const t2 = setTimeout(() => useGameStore.setState({ opening: null }), (instant ? 0 : SHAKE_MS) + SHOW_MS)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [opening])

  const color = CAPSULES[opening.capsule]?.color || '#ffd23a'

  return (
    // Click-through, so the capsule's Stop/Auto buttons stay usable underneath.
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/35">
      {phase === 'shake' ? (
        <Capsule color={color} />
      ) : (
        <>
          {opening.capsule === 'gift' && <div className="stroke anim-reveal absolute top-[14%] text-5xl text-yellow-300 sm:text-6xl">+1 SPINNER!</div>}
          <div className="anim-fade pointer-events-none absolute inset-0 bg-white/40" style={{ animationDirection: 'reverse', animationDuration: '0.5s' }} />
          <div className="flex flex-wrap items-start justify-center gap-6">
            {opening.results.map((r, i) => (
              <Card key={r.uid} result={r} delay={i * 140} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** Full-screen capsule opening: shake, flash, reveal. */
export default function CapsuleOpening() {
  const opening = useGameStore((s) => s.opening)
  if (!opening) return null
  return <Opening key={opening.at} opening={opening} />
}
