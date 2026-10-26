import { useEffect, useState } from 'react'

import {
  C2S,
  CAPSULES,
  CRYSTAL_OFFER,
  RINGS,
  SPINNERS,
  capsuleOdds,
  computeStats,
  formatNumber,
  zoneOfWorld,
} from '@shared'

import { useGameStore } from '../store/gameStore'
import { act } from './actions'
import { RarityText, SpinnerIcon } from './common'

const AUTO_MS = 1300

function CapsuleCard({ id }) {
  const capsule = CAPSULES[id]
  const profile = useGameStore((s) => s.profile)
  const opening = useGameStore((s) => s.opening)
  const [auto, setAuto] = useState(false)
  const lucky = computeStats(profile).lucky
  const odds = capsuleOdds(id, lucky)
  const balance = capsule.currency === 'candy' ? profile.candy : profile.wins
  const locked = profile.rebirths < capsule.rebirths
  const canOpen = !locked && balance >= capsule.cost

  // Auto: keep opening while standing here and affordable.
  useEffect(() => {
    if (!auto) return undefined
    const tick = () => {
      const p = useGameStore.getState().profile
      const bal = capsule.currency === 'candy' ? p.candy : p.wins
      if (bal < capsule.cost) {
        setAuto(false)
        return
      }
      act(C2S.openCapsule, { capsule: id, count: 1 })
    }
    tick()
    const t = setInterval(tick, AUTO_MS)
    return () => clearInterval(t)
  }, [auto, id, capsule])

  const price = `${formatNumber(capsule.cost)} ${capsule.currency === 'candy' ? 'Candy' : 'Wins'}`

  return (
    <div className="pointer-events-auto absolute left-1/2 top-[22%] w-[min(92vw,380px)] -translate-x-1/2 anim-fade">
      <div className="studs relative rounded-xl border-4 border-black/70 p-2 text-center" style={{ background: `linear-gradient(${capsule.color}dd, #1d2140ee)` }}>
        <div className="stroke text-2xl">{capsule.name}</div>
        <div className="stroke text-lg text-yellow-300">
          {price}
          {locked && <span className="ml-2 text-red-300">🔒 Rebirth {capsule.rebirths}</span>}
        </div>
        <div className="mt-1 grid grid-cols-4 gap-1">
          {odds.map((d) => {
            const def = SPINNERS[d.spinner]
            return (
              <div key={d.spinner} className="flex flex-col items-center rounded-lg border-2 border-black/60 bg-white/15 p-1" title={`${def.name} • ⚔️${formatNumber(def.dmg)} ❤️${formatNumber(def.hp)}`}>
                <SpinnerIcon id={d.spinner} size={56} />
                <RarityText rarity={def.rarity} className="text-[10px] leading-tight" />
                <span className="stroke text-lg leading-tight">{d.chance < 1 ? d.chance.toFixed(1) : Math.round(d.chance)}%</span>
              </div>
            )
          })}
        </div>
        {lucky && <div className="stroke-sm mt-1 text-sm text-green-300">🍀 Lucky potion active!</div>}
      </div>
      <div className="mt-2 flex justify-center gap-2">
        <button type="button" disabled={!canOpen || Boolean(opening)} className="gbtn g-green stroke px-5 py-1 text-2xl" onClick={() => act(C2S.openCapsule, { capsule: id, count: 1 })}>
          Open
        </button>
        <button
          type="button"
          disabled={locked || balance < capsule.cost * 3 || Boolean(opening)}
          className="gbtn g-blue stroke px-3 py-1 text-2xl"
          onClick={() => act(C2S.openCapsule, { capsule: id, count: 3 })}
        >
          x3
        </button>
        <button type="button" disabled={!canOpen && !auto} className={`gbtn ${auto ? 'g-orange anim-glow' : 'g-yellow'} stroke px-4 py-1 text-2xl`} onClick={() => setAuto((a) => !a)}>
          {auto ? 'Stop' : 'Auto'}
        </button>
      </div>
    </div>
  )
}

function CrystalCard() {
  const profile = useGameStore((s) => s.profile)
  const def = SPINNERS[CRYSTAL_OFFER.spinner]
  const locked = profile.rebirths < CRYSTAL_OFFER.rebirths
  return (
    <div className="pointer-events-auto absolute left-1/2 top-[22%] w-[min(92vw,340px)] -translate-x-1/2 anim-fade">
      <div className="studs relative flex items-center gap-3 rounded-xl border-4 border-black/70 bg-linear-to-b from-purple-500/90 to-[#1d2140]/95 p-3">
        <SpinnerIcon id="crystal" size={84} />
        <div className="text-left">
          <div className="stroke text-2xl">{def.name}</div>
          <RarityText rarity={def.rarity} className="text-lg" />
          <div className="stroke-sm text-sm">
            ⚔️ {formatNumber(def.dmg)} &nbsp; ❤️ {formatNumber(def.hp)}
          </div>
          <div className="stroke text-lg text-yellow-300">🏆 {formatNumber(CRYSTAL_OFFER.cost)} Wins</div>
          {locked && <div className="stroke-sm text-red-300">🔒 Rebirth {CRYSTAL_OFFER.rebirths}</div>}
        </div>
      </div>
      <div className="mt-2 flex justify-center">
        <button type="button" disabled={locked || profile.wins < CRYSTAL_OFFER.cost} className="gbtn g-purple stroke px-6 py-1 text-2xl" onClick={() => act(C2S.buyCrystal)}>
          Buy
        </button>
      </div>
    </div>
  )
}

function Hint({ children }) {
  return (
    <div className="stroke anim-bob absolute bottom-[132px] left-1/2 -translate-x-1/2 whitespace-nowrap text-center text-xl sm:bottom-[150px] sm:text-3xl">
      {children}
    </div>
  )
}

export default function NearbyPrompt() {
  const nearby = useGameStore((s) => s.nearby)
  const zone = useGameStore((s) => s.zone)
  const run = useGameStore((s) => s.run)

  if (nearby.capsule) return <CapsuleCard key={nearby.capsule} id={nearby.capsule} />
  if (nearby.crystal) return <CrystalCard />
  if (nearby.ring) {
    const ring = RINGS[nearby.ring]
    return (
      <Hint>
        Training at {ring.name} <span className="text-yellow-300">x{ring.mult}</span> — Click 🖱️ to train faster!
      </Hint>
    )
  }
  if (nearby.pad) return <Hint>Stage {nearby.pad} — get ready to battle!</Hint>
  if (nearby.returnPad) return <Hint>Cashing out your run…</Hint>
  if (run && run.cleared > 0 && zone === zoneOfWorld(run.world)) {
    return (
      <div className="stroke absolute right-3 top-[56%] rounded-xl border-4 border-black/70 bg-[#1d2140]/85 px-3 py-1 text-right text-lg">
        <div>Run: Stage {run.cleared}</div>
        {run.wins > 0 && <div className="text-yellow-300">🏆 +{formatNumber(run.wins)}</div>}
        {run.candy > 0 && <div className="text-orange-300">🍬 +{formatNumber(run.candy)}</div>}
        <div className="stroke-sm text-xs text-white/80">Yellow Return pad = cash out</div>
      </div>
    )
  }
  return null
}

