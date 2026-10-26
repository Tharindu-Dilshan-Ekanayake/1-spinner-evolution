import { AURA_LIST, C2S, formatNumber } from '@shared'

import { useGameStore } from '../../store/gameStore'
import { act } from '../actions'
import { Panel } from '../common'

export default function AurasPanel() {
  const profile = useGameStore((s) => s.profile)
  const close = useGameStore((s) => s.closePanel)
  return (
    <Panel title="AURAS" icon="⭐" color="g-blue" onClose={close}>
      <div className="flex flex-col gap-2">
        {AURA_LIST.map((a) => {
          const owned = profile.auras.includes(a.id)
          const equipped = profile.aura === a.id
          const locked = profile.rebirths < a.rebirths
          const balance = a.currency === 'candy' ? profile.candy : profile.wins
          return (
            <div key={a.id} className="flex items-center gap-3 rounded-xl border-4 border-black/60 bg-white/10 p-2">
              <div
                className="h-16 w-16 shrink-0 rounded-full border-4 border-black/60"
                style={{ background: `radial-gradient(circle, #ffffff 0%, ${a.color} 45%, transparent 72%)`, boxShadow: `0 0 18px ${a.color}` }}
              />
              <div className="flex-1">
                <div className="stroke text-xl sm:text-2xl">{a.name}</div>
                <div className="stroke text-base">
                  🏆 x{a.wins} wins
                  {a.dmg > 1 && ` • 💥 +${Math.round((a.dmg - 1) * 100)}%`}
                  {a.hp > 1 && ` • ❤️ +${Math.round((a.hp - 1) * 100)}%`}
                  {a.candy > 1 && ` • 🍬 x${a.candy}`}
                </div>
              </div>
              {owned ? (
                <button type="button" className={`gbtn ${equipped ? 'g-red' : 'g-green'} stroke w-28 py-2 text-xl`} onClick={() => act(C2S.equipAura, { id: equipped ? '' : a.id })}>
                  {equipped ? 'Unequip' : 'Equip'}
                </button>
              ) : (
                <button type="button" disabled={locked || balance < a.cost} className={`gbtn ${a.currency === 'candy' ? 'g-orange' : 'g-yellow'} stroke w-28 py-2 text-lg`} onClick={() => act(C2S.buyAura, { id: a.id })}>
                  {locked ? `🔒 R${a.rebirths}` : `${a.currency === 'candy' ? '🍬' : '🏆'} ${formatNumber(a.cost)}`}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
