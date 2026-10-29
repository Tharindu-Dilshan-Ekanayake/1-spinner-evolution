import { RARITIES, SPINNERS } from '@shared'

import { sfx } from '../audio/sfx'
import { spinnerIcon } from '../game/spinners/iconRenderer'
import { useGameStore } from '../store/gameStore'
import Icon from './kit/Icon'
import { iconUrl } from './kit/icons'
import StrokeText from './kit/StrokeText'
import { u } from './kit/style'

/** The red square X that sits on every panel's top-right corner. */
function CloseButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className="pp-btn pointer-events-auto absolute flex items-center justify-center"
      style={{
        right: 'clamp(-18px, calc(var(--px) * -24), -10px)',
        top: 'clamp(14px, calc(var(--px) * 20), 24px)',
        width: 'clamp(42px, calc(var(--px) * 96), 64px)',
        height: 'clamp(42px, calc(var(--px) * 96), 64px)',
        background: 'linear-gradient(180deg, #ff6a5c 0%, #ee2233 55%, #c4101f 100%)',
        border: '4px solid #111',
        borderRadius: 6,
        boxShadow: 'inset 0 0 0 3px #ffffff, 0 4px 0 rgba(0,0,0,0.4)',
        fontSize: 'clamp(32px, calc(var(--px) * 78), 52px)',
        lineHeight: 1,
      }}
    >
      <StrokeText stroke="0.13em">X</StrokeText>
    </button>
  )
}

/**
 * The game's modal panel, as in the studio's +1 Slide Downhill: dark rounded frame, a big
 * outlined title riding the top edge with its icon, and the red X on the corner.
 * Escape (see Hud) or a click outside closes it.
 *
 * `icon` is a kit icon name (see ui/kit/icons.js) or any short text such as an emoji.
 */
export function Panel({ title, icon, onClose, children, wide = false, extra }) {
  const close = () => {
    sfx.close()
    onClose()
  }
  // Long titles shrink to stay clear of the close button.
  const titleSize = Math.min(92, ((wide ? 1150 : 860) - 190) / (title.length * 0.62))
  const font = `clamp(28px, ${u(titleSize)}, 62px)`
  return (
    <div
      className="pp-font pointer-events-auto absolute inset-0 z-30 flex items-center justify-center p-3"
      style={{ background: 'rgba(0, 0, 0, 0.18)' }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className={`pp-panel-in relative flex w-full flex-col ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
        <div className="panel mt-9 flex max-h-[84vh] w-full flex-col px-3 pb-3 pt-10 sm:mt-11 sm:pt-12">
          {extra && <div className="mb-2 flex justify-end">{extra}</div>}
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
        <div className="pointer-events-none absolute left-3 top-0 flex items-center leading-none" style={{ fontSize: font, gap: 6 }}>
          {icon && (iconUrl(icon) ? <Icon name={icon} size="1.3em" style={{ marginTop: '-0.2em' }} /> : <span className="text-[0.9em]">{icon}</span>)}
          <StrokeText stroke="0.17em">{title}</StrokeText>
        </div>
        <CloseButton onClick={close} />
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
        // `size` may be a CSS length (the HUD's scaled units): the image fills its box.
        <img src={url} alt={def?.name || id} draggable={false} className={`h-full w-full ${def?.glow ? 'anim-glow' : ''}`} />
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

