import { sfx } from '../../audio/sfx'
import { useGameStore } from '../../store/gameStore'
import Icon from '../kit/Icon'
import { ChunkyButton } from '../kit/parts'
import StrokeText from '../kit/StrokeText'
import { GRADIENTS } from '../kit/style'

/**
 * The Shop button opens one place for everything you buy: spinners (the Spinners
 * Shop), auras and trails, one tab each. (Your own spinners have their own button.)
 */
const TABS = [
  { panel: 'shop', label: 'Spinners', icon: 'shop' },
  { panel: 'auras', label: 'Auras', icon: 'auraAvatar' },
  { panel: 'trails', label: 'Trails', icon: 'sneaker' },
]

export default function ShopTabs() {
  const active = useGameStore((s) => s.panel)
  return (
    <div className="mb-3 grid grid-cols-3 gap-2">
      {TABS.map((t) => {
        const on = t.panel === active
        return (
          <ChunkyButton
            key={t.panel}
            gradient={on ? GRADIENTS.goldButton : GRADIENTS.slate}
            radius={12}
            quiet
            title={t.label}
            className={on ? '' : 'opacity-90'}
            style={{ height: 52, gap: 4 }}
            onClick={() => {
              if (on) return
              sfx.click()
              useGameStore.getState().setPanel(t.panel)
            }}
          >
            <Icon name={t.icon} size={34} />
            <span className="hidden text-lg sm:inline">
              <StrokeText stroke={5}>{t.label}</StrokeText>
            </span>
          </ChunkyButton>
        )
      })}
    </div>
  )
}
