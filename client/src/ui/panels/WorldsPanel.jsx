import { C2S, WORLD_LIST, worldUnlocked } from '@shared'

import { useGameStore } from '../../store/gameStore'
import { act } from '../actions'
import { Panel } from '../common'

const ART = {
  grassland: { icon: '🌳', color: 'from-green-500/80' },
  lava: { icon: '🌋', color: 'from-orange-600/80' },
  galaxy: { icon: '🌌', color: 'from-purple-700/80' },
  halloween: { icon: '🎃', color: 'from-orange-500/80' },
}

export default function WorldsPanel() {
  const profile = useGameStore((s) => s.profile)
  const zone = useGameStore((s) => s.zone)
  const close = useGameStore((s) => s.closePanel)

  const travel = (to, spot) => {
    act(C2S.teleport, spot ? { to, spot } : { to })
    close()
  }

  return (
    <Panel title="Worlds" icon="🌍" color="g-blue" onClose={close}>
      <div className="flex flex-col gap-2">
        {zone !== 'lobby' && (
          <button type="button" className="gbtn g-green stroke py-2 text-2xl" onClick={() => travel('lobby')}>
            🏠 Back to Lobby
          </button>
        )}
        {WORLD_LIST.map((w) => {
          const open = worldUnlocked(w.id, profile)
          const best = profile.best?.[w.id] || 0
          const range = w.event ? `${w.stageCount} spooky stages` : `Stages ${w.firstStage}-${w.firstStage + w.stageCount - 1}`
          const req = []
          if (w.rebirths) req.push(`Rebirth ${w.rebirths}`)
          if (w.requiresStage) req.push(`Clear Stage ${w.requiresStage}`)
          return (
            <div key={w.id} className={`flex items-center gap-3 rounded-xl border-4 border-black/60 bg-linear-to-r ${ART[w.id].color} to-[#1d2140]/90 p-2`}>
              <span className="text-5xl">{ART[w.id].icon}</span>
              <div className="flex-1">
                <div className="stroke text-2xl">{w.name}</div>
                <div className="stroke-sm text-sm">
                  {range}
                  {best > 0 && ` • Best: ${w.event ? `Stage ${best}` : `Stage ${best}`}`}
                </div>
                {!open && <div className="stroke-sm text-sm text-red-300">🔒 {req.join(' + ')}</div>}
              </div>
              <button type="button" disabled={!open || zone === w.id} className="gbtn g-green stroke px-4 py-2 text-xl" onClick={() => travel(w.id)}>
                {zone === w.id ? 'Here' : 'Go!'}
              </button>
            </div>
          )
        })}
        {zone === 'lobby' && (
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button type="button" className="gbtn g-yellow stroke py-1 text-lg" onClick={() => travel('lobby', 'training')}>
              💥 Training
            </button>
            <button type="button" className="gbtn g-red stroke py-1 text-lg" onClick={() => travel('lobby', 'shop')}>
              🛒 Wins Shop
            </button>
          </div>
        )}
      </div>
    </Panel>
  )
}
