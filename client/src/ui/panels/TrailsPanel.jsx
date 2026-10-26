import { C2S, TRAIL_LIST, formatNumber } from '@shared'

import { useGameStore } from '../../store/gameStore'
import { act } from '../actions'
import { Panel } from '../common'

function Swatch({ colors }) {
  return (
    <div
      className="h-16 w-16 shrink-0 rotate-12 rounded-full border-4 border-black/60"
      style={{ background: `conic-gradient(${[...colors, colors[0]].join(',')})` }}
    />
  )
}

export default function TrailsPanel() {
  const profile = useGameStore((s) => s.profile)
  const close = useGameStore((s) => s.closePanel)
  return (
    <Panel title="TRAILS" icon="💫" color="g-green" onClose={close}>
      <div className="flex flex-col gap-2">
        {TRAIL_LIST.map((t) => {
          const owned = profile.trails.includes(t.id)
          const equipped = profile.trail === t.id
          const locked = profile.rebirths < t.rebirths
          return (
            <div key={t.id} className="flex items-center gap-3 rounded-xl border-4 border-black/60 bg-linear-to-r from-white/15 to-white/5 p-2">
              <Swatch colors={t.colors} />
              <div className="flex-1">
                <div className="stroke text-xl sm:text-2xl">{t.name}</div>
                <div className="stroke text-lg">👟 +{Math.round(t.speed * 100)}% &nbsp; 💥 x{t.power}</div>
              </div>
              {owned ? (
                <button type="button" className={`gbtn ${equipped ? 'g-red' : 'g-green'} stroke w-28 py-2 text-xl`} onClick={() => act(C2S.equipTrail, { id: equipped ? '' : t.id })}>
                  {equipped ? 'Unequip' : 'Equip'}
                </button>
              ) : (
                <button type="button" disabled={locked || profile.wins < t.cost} className="gbtn g-yellow stroke w-28 py-2 text-lg" onClick={() => act(C2S.buyTrail, { id: t.id })}>
                  {locked ? `🔒 R${t.rebirths}` : `🏆 ${formatNumber(t.cost)}`}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
