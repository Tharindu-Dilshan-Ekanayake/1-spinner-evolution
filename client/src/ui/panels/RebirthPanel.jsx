import { C2S, REBIRTH_PERKS, RING_LIST, rebirthLevelReq, rebirthMult } from '@shared'

import { useGameStore } from '../../store/gameStore'
import { act } from '../actions'
import { Panel } from '../common'

function Box({ children, color }) {
  return <div className={`${color} stroke relative flex h-14 flex-1 items-center justify-center rounded-lg border-4 border-black/70 text-3xl`}>{children}</div>
}

export default function RebirthPanel() {
  const profile = useGameStore((s) => s.profile)
  const close = useGameStore((s) => s.closePanel)
  const need = rebirthLevelReq(profile.rebirths)
  const ready = profile.level >= need
  const pct = Math.min(100, (profile.level / need) * 100)
  const nextRing = RING_LIST.find((r) => r.rebirths === profile.rebirths + 1)

  return (
    <Panel title="REBIRTH" icon="rebirth" onClose={close}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
        <div className="stroke text-2xl">Before</div>
        <div />
        <div className="stroke text-2xl">After</div>
        <Box color="g-pink">💥 x{rebirthMult(profile.rebirths).toFixed(2)}</Box>
        <span className="stroke text-4xl">➜</span>
        <Box color="g-pink">💥 x{rebirthMult(profile.rebirths + 1).toFixed(2)}</Box>
        <Box color="g-blue">LEVEL {profile.level}</Box>
        <span className="stroke text-4xl">➜</span>
        <Box color="g-red">LEVEL 1</Box>
      </div>

      <div className="relative mx-auto mt-3 h-8 w-full overflow-hidden rounded-lg border-4 border-black/70 bg-[#123018]">
        <div className="h-full bg-linear-to-b from-lime-300 to-green-600" style={{ width: `${pct}%` }} />
        <div className="stroke absolute inset-0 text-center text-xl leading-6">
          Level {profile.level}/{need}
        </div>
      </div>

      <div className="stroke mt-2 text-center text-lg text-yellow-300">Rebirth resets your level, for a permanent power boost.</div>
      <div className="stroke-sm text-center text-sm">Your wins, spinners, trails, auras and potions are all kept.</div>

      <div className="mt-2 flex justify-center">
        <button type="button" disabled={!ready} className="gbtn g-rainbow stroke px-10 py-2 text-3xl" onClick={() => act(C2S.rebirth)}>
          Rebirth
        </button>
      </div>

      <div className="stroke mt-4 text-xl">Rebirth rewards</div>
      {nextRing && (
        <div className="stroke-sm mb-1 text-sm text-green-300">
          Next rebirth unlocks the {nextRing.name} ring (x{nextRing.mult} power)!
        </div>
      )}
      <div className="flex flex-col gap-1">
        {REBIRTH_PERKS.map((perk) => {
          const owned = profile.rebirths >= perk.rebirths
          return (
            <div key={perk.id} className={`flex items-center gap-2 rounded-lg border-2 border-black/60 px-2 py-1 ${owned ? 'bg-green-600/40' : 'bg-white/10'}`}>
              <span className="stroke w-24 text-lg text-purple-300">R{perk.rebirths}</span>
              <div className="flex-1">
                <div className="stroke text-lg leading-tight">{perk.name}</div>
                <div className="stroke-sm text-xs">{perk.desc}</div>
              </div>
              {/* AUTO WIN is switched on and off here (it has no HUD button). */}
              {perk.id === 'autoWin' && owned ? (
                <button type="button" className={`gbtn ${profile.autoWin ? 'g-green' : 'g-gray'} stroke px-3 py-1 text-base`} onClick={() => act(C2S.autoWin, { on: !profile.autoWin })}>
                  {profile.autoWin ? 'ON' : 'OFF'}
                </button>
              ) : (
                <span className="text-xl">{owned ? '✅' : '🔒'}</span>
              )}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
