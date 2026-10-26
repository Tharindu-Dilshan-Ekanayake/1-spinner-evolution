import { C2S, CAPSULE_LIST, CRYSTAL_OFFER, SPINNERS, capsuleOdds, formatNumber } from '@shared'

import { useGameStore } from '../../store/gameStore'
import { act } from '../actions'
import { Panel, RarityText, SpinnerIcon } from '../common'

function go(spot) {
  act(C2S.teleport, { to: 'lobby', spot })
  useGameStore.getState().closePanel()
}

/** Catalogue of every capsule with its odds; capsules are opened at their machines. */
export default function ShopPanel() {
  const profile = useGameStore((s) => s.profile)
  const zone = useGameStore((s) => s.zone)
  const close = useGameStore((s) => s.closePanel)

  return (
    <Panel title="Shop" icon="🛒" color="g-red" wide onClose={close}>
      <div className="stroke-sm mb-2 text-center text-sm">
        Everything is bought with 🏆 Wins (or 🍬 Candy) — walk up to a capsule machine to open it!
      </div>
      <div className="flex flex-col gap-2">
        {CAPSULE_LIST.map((c) => {
          const locked = profile.rebirths < c.rebirths
          return (
            <div key={c.id} className="rounded-xl border-4 border-black/60 p-2" style={{ background: `linear-gradient(90deg, ${c.color}88, #1d214099)` }}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="stroke text-xl sm:text-2xl">{c.name}</div>
                  <div className="stroke text-base text-yellow-300">
                    {c.currency === 'candy' ? '🍬' : '🏆'} {formatNumber(c.cost)}
                    {c.rebirths > 0 && <span className={locked ? 'text-red-300' : 'text-green-300'}> • Rebirth {c.rebirths}</span>}
                  </div>
                </div>
                <button type="button" className="gbtn g-blue stroke px-3 py-1 text-lg" onClick={() => go(c.id === 'halloween' ? 'halloween' : 'shop')} disabled={zone !== 'lobby'}>
                  Go ➜
                </button>
              </div>
              <div className="mt-1 grid grid-cols-4 gap-1">
                {capsuleOdds(c.id).map((d) => (
                  <div key={d.spinner} className="flex flex-col items-center rounded-lg bg-black/25 p-1">
                    <SpinnerIcon id={d.spinner} size={44} />
                    <span className="stroke-sm w-full truncate text-center text-[11px]">{SPINNERS[d.spinner].name}</span>
                    <RarityText rarity={SPINNERS[d.spinner].rarity} className="text-[10px]" />
                    <span className="stroke text-sm">{d.chance}%</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        <div className="flex items-center gap-3 rounded-xl border-4 border-black/60 bg-linear-to-r from-purple-600/70 to-[#1d2140]/80 p-2">
          <SpinnerIcon id="crystal" size={64} />
          <div className="flex-1">
            <div className="stroke text-2xl">Crystal Spinner</div>
            <div className="stroke text-base text-yellow-300">
              🏆 {formatNumber(CRYSTAL_OFFER.cost)} • Rebirth {CRYSTAL_OFFER.rebirths}
            </div>
          </div>
          <button type="button" className="gbtn g-blue stroke px-3 py-1 text-lg" onClick={() => go('shop')} disabled={zone !== 'lobby'}>
            Go ➜
          </button>
        </div>
      </div>
    </Panel>
  )
}
