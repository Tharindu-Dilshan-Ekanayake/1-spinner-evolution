import { RARITIES, SPINNERS } from '@shared'

import { sfx } from '../audio/sfx'
import { spinnerIcon } from '../game/spinners/iconRenderer'
import { useGameStore } from '../store/gameStore'

/** Modal panel with the coloured title bar and red X from the original. */
export function Panel({ title, icon, color = 'g-yellow', onClose, children, wide = false, extra }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-3">
      <div className={`panel flex max-h-[86vh] w-full flex-col ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
        <div className={`panel-head ${color} studs relative flex items-center gap-2 px-3 py-2`}>
          {icon && <span className="text-3xl drop-shadow">{icon}</span>}
          <h2 className="stroke flex-1 text-2xl sm:text-3xl">{title}</h2>
          {extra}
          <button
            type="button"
            className="gbtn g-red h-10 w-10 text-2xl leading-none stroke"
            onClick={() => {
              sfx.close()
              onClose()
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
      </div>
    </div>
  )
}

/** Spinner picture rendered by the game itself; re-renders when icons arrive. */
export function SpinnerIcon({ id, golden = false, size = 64, className = '' }) {
  useGameStore((s) => s.iconVersion)
  const url = spinnerIcon(id, golden)
  const def = SPINNERS[id]
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {url ? (
        <img src={url} alt={def?.name || id} width={size} height={size} draggable={false} className={def?.glow ? 'anim-glow' : ''} />
      ) : (
        <div className="h-1/2 w-1/2 animate-pulse rounded-full" style={{ background: def?.a || '#888' }} />
      )}
      {golden && <span className="absolute -right-1 -top-1 text-sm">✨</span>}
    </div>
  )
}

export function RarityText({ rarity, className = '' }) {
  const r = RARITIES[rarity] || RARITIES.common
  if (r.rainbow) return <span className={`rainbow-text ${className}`}>{r.name}</span>
  return (
    <span className={`stroke-sm ${className}`} style={{ color: r.color }}>
      {r.name}
    </span>
  )
}

/** Small pill showing a stat with an icon (⚔️ 12, ❤️ 100). */
export function StatPill({ icon, value, color = 'g-dark', className = '' }) {
  return (
    <div className={`${color} flex items-center gap-1 rounded-lg border-2 border-black/60 px-2 py-0.5 text-lg ${className}`}>
      <span>{icon}</span>
      <span className="stroke-sm">{value}</span>
    </div>
  )
}

