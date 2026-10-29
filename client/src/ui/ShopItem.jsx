import { C2S, SHOP_ITEMS, SPINNERS, computeStats, formatNumber, spinnerPrice, spinnerStats } from '@shared'

import { useGameStore } from '../store/gameStore'
import { act } from './actions'
import { RarityText, SpinnerIcon } from './common'
import Icon from './kit/Icon'

/**
 * One spinner for sale in the Spinners Shop: what it is, how strong, how many you own,
 * what it costs (25% off with a Lucky potion) and a Buy button. Used at the lobby
 * pads and in the Shop panel.
 */
export default function ShopItem({ id, compact = false }) {
  const profile = useGameStore((s) => s.profile)
  const opening = useGameStore((s) => Boolean(s.opening))
  const item = SHOP_ITEMS[id]
  const def = SPINNERS[id]
  if (!item || !def) return null
  const lucky = computeStats(profile).lucky
  const price = spinnerPrice(id, lucky)
  const balance = profile.wins
  const locked = profile.rebirths < item.rebirths
  const afford = balance >= price
  const owned = profile.inventory.filter((s) => s.id === id).length
  const st = spinnerStats(id, false)
  return (
    <div className="relative flex flex-col items-center rounded-xl border-4 border-black/60 bg-white/10 p-1.5 text-center">
      {owned > 0 && (
        <span className="stroke-sm absolute -right-2 -top-2 rounded-full border-2 border-black bg-green-500 px-1.5 text-xs leading-5">
          x{owned}
        </span>
      )}
      <SpinnerIcon id={id} size={compact ? 52 : 64} />
      {/* Wraps rather than cuts off: a phone's 4-wide stand card is narrow. */}
      <div className="stroke line-clamp-2 w-full break-words text-sm leading-tight">{def.name}</div>
      <RarityText rarity={def.rarity} className="text-[11px] leading-tight" />
      <div className="stroke-sm text-[11px] leading-tight">
        ⚔️ {formatNumber(st.dmg)} ❤️ {formatNumber(st.hp)}
      </div>
      <button
        type="button"
        disabled={locked || !afford || opening}
        onClick={() => act(C2S.buySpinner, { id })}
        className={`gbtn ${locked ? 'g-gray' : 'g-green'} stroke mt-auto flex w-full items-center justify-center gap-1 whitespace-nowrap px-1 py-0.5 text-sm`}
        title={locked ? `Requires Rebirth ${item.rebirths}` : afford ? 'Buy' : 'Not enough yet'}
      >
        {locked ? (
          `🔒 Rebirth ${item.rebirths}`
        ) : (
          // White on green reads at any size; the word "Buy" only where there's room.
          <>
            {!compact && 'Buy'}
            <Icon name="trophy" size="1.15em" />
            {formatNumber(price)}
          </>
        )}
      </button>
    </div>
  )
}
