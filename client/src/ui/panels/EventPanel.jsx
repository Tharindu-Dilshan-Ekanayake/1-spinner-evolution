import { AURAS, C2S, CAPSULES, SPINNERS, WORLDS, capsuleOdds, formatNumber, worldUnlocked } from '@shared'

import { useGameStore } from '../../store/gameStore'
import { act } from '../actions'
import { Panel, RarityText, SpinnerIcon } from '../common'

/** The Halloween event: earn candy in the Halloween world, spend it here. */
export default function EventPanel() {
  const profile = useGameStore((s) => s.profile)
  const zone = useGameStore((s) => s.zone)
  const close = useGameStore((s) => s.closePanel)
  const world = WORLDS.halloween
  const open = worldUnlocked('halloween', profile)
  const capsule = CAPSULES.halloween
  const aura = AURAS.spooky
  const best = profile.best?.halloween || 0

  const go = (payload) => {
    act(C2S.teleport, payload)
    close()
  }

  return (
    <Panel title="Halloween Event" icon="🎃" color="g-orange" onClose={close}>
      <div className="studs relative rounded-xl border-4 border-black/60 bg-linear-to-b from-purple-800/80 to-[#1d2140] p-3 text-center">
        <div className="stroke text-3xl text-orange-300">🍬 {formatNumber(profile.candy)} Candy</div>
        <div className="stroke-sm text-sm">Beat the spooky stages and grab pumpkins around the lobby for candy!</div>
        <div className="stroke mt-1 text-lg">
          Best: Stage {best}/{world.stageCount}
        </div>
        <button type="button" disabled={!open || zone === 'halloween'} className="gbtn g-orange stroke mt-2 px-6 py-2 text-2xl" onClick={() => go({ to: 'halloween' })}>
          {open ? '👻 Enter Halloween World' : `🔒 Clear Stage ${world.requiresStage} first`}
        </button>
      </div>

      <div className="mt-3 rounded-xl border-4 border-black/60 bg-linear-to-r from-orange-600/70 to-[#1d2140]/80 p-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="stroke text-2xl">{capsule.name}</div>
            <div className="stroke text-orange-300">🍬 {capsule.cost} Candy</div>
          </div>
          <button type="button" disabled={zone !== 'lobby'} className="gbtn g-blue stroke px-3 py-1 text-lg" onClick={() => go({ to: 'lobby', spot: 'halloween' })}>
            Go ➜
          </button>
        </div>
        <div className="mt-1 grid grid-cols-4 gap-1">
          {capsuleOdds('halloween').map((d) => (
            <div key={d.spinner} className="flex flex-col items-center rounded-lg bg-black/25 p-1">
              <SpinnerIcon id={d.spinner} size={52} />
              <span className="stroke-sm w-full truncate text-center text-[11px]">{SPINNERS[d.spinner].name}</span>
              <RarityText rarity={SPINNERS[d.spinner].rarity} className="text-[10px]" />
              <span className="stroke text-sm">{d.chance}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-xl border-4 border-black/60 bg-white/10 p-2">
        <div className="h-14 w-14 rounded-full" style={{ background: `radial-gradient(circle, #fff, ${aura.color} 45%, transparent 72%)` }} />
        <div className="flex-1">
          <div className="stroke text-xl">{aura.name}</div>
          <div className="stroke-sm text-sm">🏆 x{aura.wins} wins • 🍬 x{aura.candy} candy</div>
        </div>
        {profile.auras.includes('spooky') ? (
          <button type="button" className="gbtn g-green stroke px-3 py-1 text-lg" onClick={() => act(C2S.equipAura, { id: profile.aura === 'spooky' ? '' : 'spooky' })}>
            {profile.aura === 'spooky' ? 'Unequip' : 'Equip'}
          </button>
        ) : (
          <button type="button" disabled={profile.candy < aura.cost} className="gbtn g-orange stroke px-3 py-1 text-lg" onClick={() => act(C2S.buyAura, { id: 'spooky' })}>
            🍬 {aura.cost}
          </button>
        )}
      </div>
    </Panel>
  )
}
