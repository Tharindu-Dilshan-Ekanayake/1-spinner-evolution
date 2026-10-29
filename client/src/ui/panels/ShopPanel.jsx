import { Fragment } from 'react'

import { C2S, CAPSULE_LIST, CRYSTAL_OFFER, formatNumber } from '@shared'

import { useGameStore } from '../../store/gameStore'
import { act } from '../actions'
import { Panel, SpinnerIcon } from '../common'
import Icon from '../kit/Icon'
import StrokeText from '../kit/StrokeText'
import ShopItem from '../ShopItem'
import ShopTabs from './ShopTabs'

function go(spot) {
  act(C2S.teleport, { to: 'lobby', spot })
  useGameStore.getState().closePanel()
}

/** The whole game in three pictures: where spinners come from. */
const STEPS = [
  { icon: 'muscle', title: 'Train', text: 'Level up: +1 spinner & stronger' },
  { icon: 'trophy', title: 'Battle', text: 'Beat stages to earn Wins' },
  { icon: 'shop', title: 'Buy', text: 'Spend Wins on the spinner you want' },
]

function HowItWorks() {
  return (
    <div className="mb-3 flex items-stretch gap-1">
      {STEPS.map((step, i) => (
        <Fragment key={step.title}>
          {i > 0 && <span className="stroke self-center text-2xl">➜</span>}
          <div className="flex flex-1 flex-col items-center rounded-xl border-4 border-black/60 bg-white/10 p-1 text-center">
            <Icon name={step.icon} size={48} />
            <span className="text-2xl leading-tight">
              <StrokeText stroke={6}>{step.title}</StrokeText>
            </span>
            <span className="stroke-sm text-xs leading-tight sm:text-sm">{step.text}</span>
          </div>
        </Fragment>
      ))}
    </div>
  )
}

/** Catalogue of every capsule with its odds; capsules are opened at their machines. */
export default function ShopPanel() {
  const profile = useGameStore((s) => s.profile)
  const zone = useGameStore((s) => s.zone)
  const close = useGameStore((s) => s.closePanel)

  return (
    <Panel title="Spinners Shop" icon="shop" wide onClose={close}>
      <ShopTabs />
      <HowItWorks />
      <div className="stroke-sm mb-2 text-center text-sm">Buy any spinner right here, or walk to its stand in the Spinners Shop.</div>
      <div className="flex flex-col gap-2">
        {CAPSULE_LIST.map((c) => {
          const locked = profile.rebirths < c.rebirths
          return (
            <div key={c.id} className="rounded-xl border-4 border-black/60 p-2" style={{ background: `linear-gradient(90deg, ${c.color}88, #1d214099)` }}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="stroke text-xl sm:text-2xl">
                  {c.name}
                  {c.rebirths > 0 && <span className={`text-base ${locked ? 'text-red-300' : 'text-green-300'}`}> • Rebirth {c.rebirths}</span>}
                </div>
                <button type="button" className="gbtn g-blue stroke px-3 py-1 text-base" onClick={() => go('shop')} disabled={zone !== 'lobby'}>
                  Go to stand ➜
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {c.items.map((it) => (
                  <ShopItem key={it.spinner} id={it.spinner} />
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
