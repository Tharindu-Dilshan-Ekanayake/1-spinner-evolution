import { useEffect } from 'react'

import { RARITIES, SPINNERS, formatNumber } from '@shared'

import { sfx } from '../audio/sfx'
import { useGameStore } from '../store/gameStore'
import { RarityText, SpinnerIcon } from './common'
import { GRADIENTS } from './kit/style'

const SHOW_MS = 1700

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
      {/* Where it went: on the team (it fights for you now) or kept in the Spinners bag. */}
      <div
        className="stroke relative mt-1 whitespace-nowrap rounded-full border-4 border-[#111] px-3 text-base leading-7"
        style={{ background: result.equipped === false ? GRADIENTS.slate : GRADIENTS.greenButton }}
      >
        {result.equipped === false ? 'Saved in Spinners' : 'Joined your team!'}
      </div>
    </div>
  )
}

/** The headline over each kind of reveal. */
const HEADLINE = { gift: '+1 SPINNER!', buy: 'NEW SPINNER!', crystal: 'NEW SPINNER!', golden: 'GOLDEN!' }

/** One reveal; remounted (fresh state) for every new spinner via its key. */
function Opening({ opening }) {
  useEffect(() => {
    sfx.reveal(Math.max(...opening.results.map((r) => RARITIES[SPINNERS[r.id].rarity].order)))
    const t = setTimeout(() => useGameStore.setState({ opening: null }), SHOW_MS)
    return () => clearTimeout(t)
  }, [opening])

  const headline = HEADLINE[opening.capsule]
  return (
    // Click-through, so the shop's Buy buttons stay usable underneath.
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/35">
      {headline && <div className="stroke anim-reveal absolute top-[14%] text-5xl text-yellow-300 sm:text-6xl">{headline}</div>}
      <div className="anim-fade pointer-events-none absolute inset-0 bg-white/40" style={{ animationDirection: 'reverse', animationDuration: '0.5s', animationFillMode: 'forwards' }} />
      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-wrap items-start justify-center gap-6">
          {opening.results.map((r, i) => (
            <Card key={r.uid} result={r} delay={i * 140} />
          ))}
        </div>
        {/* What just happened, in words a first-time player gets. */}
        <div className="stroke anim-fade max-w-[90vw] text-center text-lg sm:text-xl">
          {opening.capsule === 'gift'
            ? 'Level up! Your team has room for 1 more spinner. Train to reach the next one.'
            : 'Your spinners fight for you in battles. See your team in the Spinners button.'}
        </div>
      </div>
    </div>
  )
}

/** Full-screen reveal of a new spinner (bought, gifted, crafted): flash, then the card. */
export default function CapsuleOpening() {
  const opening = useGameStore((s) => s.opening)
  if (!opening) return null
  return <Opening key={opening.at} opening={opening} />
}
