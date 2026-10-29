import { useEffect } from 'react'

import { C2S, CRYSTAL_OFFER, RINGS, SHOP_ITEMS, SPINNERS, computeStats, formatNumber, spinnerPrice, spinnerStats } from '@shared'

import { useGameStore } from '../store/gameStore'
import { act } from './actions'
import { RarityText, SpinnerIcon } from './common'
import Icon from './kit/Icon'
import { ChunkyButton } from './kit/parts'
import StrokeText from './kit/StrokeText'
import { GRADIENTS, u } from './kit/style'

/** The dark card the prompts sit on (the kit's panel look, smaller). */
const CARD = {
  background: GRADIENTS.panel,
  border: '5px solid #0b0c0e',
  borderRadius: 10,
  boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.08), 0 8px 24px rgba(0,0,0,0.35)',
}

/** Phones and tablets have no E key: their prompt says "Tap" instead. */
const TOUCH = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

/**
 * Standing at a pad in the Spinners Shop (or the Crystal Spinner's): the spinner on it,
 * what it costs, and "[E] Buy" - press E, or tap the button. Says plainly why you can't
 * buy it yet (locked, or how many more wins you need).
 */
function BuyPrompt({ id, price, locked, lockText, buy }) {
  const profile = useGameStore((s) => s.profile)
  const opening = useGameStore((s) => Boolean(s.opening))
  const def = SPINNERS[id]
  const st = spinnerStats(id, false)
  const short = Math.max(0, price - profile.wins)
  const can = !locked && !short && !opening
  const owned = profile.inventory.filter((s) => s.id === id).length

  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat || e.code !== 'KeyE' || e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return
      if (can) buy()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [can, buy])

  return (
    <div className="pp-font pointer-events-auto absolute left-1/2 top-[24%] w-[min(92vw,380px)] -translate-x-1/2 anim-fade">
      <div className="relative flex items-center gap-3 p-3" style={CARD}>
        {owned > 0 && (
          <span className="stroke-sm absolute -right-3 -top-3 rounded-full border-2 border-black bg-green-500 px-2 text-sm leading-6">You have {owned}</span>
        )}
        <SpinnerIcon id={id} size={76} />
        <div className="min-w-0 text-left">
          <div className="truncate text-2xl leading-tight">
            <StrokeText stroke={6}>{def.name}</StrokeText>
          </div>
          <RarityText rarity={def.rarity} className="text-base" />
          <div className="stroke-sm text-sm">
            ⚔️ {formatNumber(st.dmg)} &nbsp; ❤️ {formatNumber(st.hp)}
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-col items-center gap-1">
        <ChunkyButton
          gradient={locked ? GRADIENTS.greyButton : GRADIENTS.greenButton}
          disabled={!can}
          onClick={buy}
          title={locked ? lockText : 'Buy'}
          radius={16}
          style={{ height: 54, padding: '0 22px', gap: 10 }}
        >
          {locked ? (
            <>
              <Icon name="lock" size={30} />
              <span className="text-2xl">
                <StrokeText stroke={6}>{lockText}</StrokeText>
              </span>
            </>
          ) : (
            <>
              {!TOUCH && (
                <span className="flex items-center justify-center rounded-md border-[3px] border-black bg-white text-xl leading-none text-black" style={{ width: 34, height: 34 }}>
                  E
                </span>
              )}
              <span className="text-2xl">
                <StrokeText stroke={6}>{TOUCH ? 'Tap to buy' : 'Buy'}</StrokeText>
              </span>
              <Icon name="trophy" size={32} />
              <span className="text-2xl">
                <StrokeText stroke={6} gradient={short ? GRADIENTS.priceShort : GRADIENTS.gold}>
                  {formatNumber(price)}
                </StrokeText>
              </span>
            </>
          )}
        </ChunkyButton>
        {!locked && short > 0 && (
          <div className="stroke-sm text-center text-base">
            Need {formatNumber(short)} more wins - beat stages!
          </div>
        )}
      </div>
    </div>
  )
}

/** At one of the shop's spinner pads. */
function ShopPadPrompt({ id }) {
  const profile = useGameStore((s) => s.profile)
  const item = SHOP_ITEMS[id]
  const price = spinnerPrice(id, computeStats(profile).lucky)
  const buy = () => act(C2S.buySpinner, { id })
  return (
    <BuyPrompt id={id} price={price} locked={profile.rebirths < item.rebirths} lockText={`Rebirth ${item.rebirths}`} buy={buy} />
  )
}

/** At the Crystal Spinner's big pad. */
function CrystalPrompt() {
  const profile = useGameStore((s) => s.profile)
  const buy = () => act(C2S.buyCrystal)
  return (
    <BuyPrompt
      id={CRYSTAL_OFFER.spinner}
      price={CRYSTAL_OFFER.cost}
      locked={profile.rebirths < CRYSTAL_OFFER.rebirths}
      lockText={`Rebirth ${CRYSTAL_OFFER.rebirths}`}
      buy={buy}
    />
  )
}

function Hint({ children }) {
  return (
    <div className="pp-font anim-bob absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-center" style={{ bottom: u(290), fontSize: u(44) }}>
      <StrokeText stroke={u(9)}>{children}</StrokeText>
    </div>
  )
}

export default function NearbyPrompt() {
  const nearby = useGameStore((s) => s.nearby)
  const run = useGameStore((s) => s.run)

  if (nearby.shopPad) return <ShopPadPrompt key={nearby.shopPad} id={nearby.shopPad} />
  if (nearby.crystal) return <CrystalPrompt />
  if (nearby.ring) {
    const ring = RINGS[nearby.ring]
    return <Hint>{`Training at ${ring.name} x${ring.mult} - click to train faster!`}</Hint>
  }
  if (nearby.padHint) return <Hint>Stand on the square pad to train!</Hint>
  if (nearby.pad) {
    const replay = run && nearby.pad <= run.cleared
    return <Hint>{replay ? `Stage ${nearby.pad} again - win more wins!` : `Stage ${nearby.pad} - get ready to battle!`}</Hint>
  }
  if (nearby.returnPad) return <Hint>Cashing out your run…</Hint>
  return null
}
