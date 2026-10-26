import { POTIONS, formatNumber } from '@shared'

import { useGameStore } from '../store/gameStore'

const TOAST_STYLE = {
  error: 'bg-red-600/95',
  info: 'bg-[#1d2140]/95',
  rebirth: 'g-purple',
}

export function Toasts() {
  const toasts = useGameStore((s) => s.toasts)
  return (
    <div className="absolute left-1/2 top-3 z-30 flex w-[min(92vw,420px)] -translate-x-1/2 flex-col items-center gap-1">
      {toasts.map((t) => (
        <div key={t.id} className={`stroke anim-fade rounded-xl border-4 border-black/70 px-4 py-1 text-center text-lg ${TOAST_STYLE[t.kind] || TOAST_STYLE.info}`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

function rewardLines(reward) {
  const lines = []
  if (reward?.wins) lines.push({ text: `+${formatNumber(reward.wins)} WINS!`, color: '#ffe14d', icon: '🏆' })
  if (reward?.candy) lines.push({ text: `+${formatNumber(reward.candy)} CANDY!`, color: '#ffb04d', icon: '🍬' })
  if (reward?.potion) lines.push({ text: `+1 ${POTIONS[reward.potion].name.toUpperCase()} POTION`, color: '#7df9ff', icon: POTIONS[reward.potion].icon })
  return lines
}

/** "+7 WINS! KEEP GOING!" and friends, floating up the middle of the screen. */
export function Rewards() {
  const rewards = useGameStore((s) => s.rewards)
  return (
    <div className="absolute left-1/2 top-[38%] z-30 w-[min(94vw,600px)]">
      {rewards.map((r, i) => {
        const lines = rewardLines(r.reward)
        if (!lines.length && !r.text) return null
        return (
          <div key={r.id} className="anim-reward absolute left-1/2 flex w-full flex-col items-center" style={{ top: i * 72 }}>
            {r.label && !r.quiet && <div className="stroke text-xl text-white sm:text-2xl">{r.label}</div>}
            {r.text && <div className="stroke text-base text-green-300 sm:text-lg">{r.text}</div>}
            {lines.map((l) => (
              <div key={l.text} className={`stroke ${r.quiet ? 'text-2xl' : 'text-4xl sm:text-5xl'}`} style={{ color: l.color }}>
                {l.icon} {l.text}
                {r.run && ' KEEP GOING!'}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

/** The sliding "LEVEL UP! 1 >> 2" banner. */
export function LevelUpBanner() {
  const levelUp = useGameStore((s) => s.levelUp)
  if (!levelUp) return null
  return (
    <div key={levelUp.at} className="anim-banner pointer-events-none absolute left-0 right-0 top-[18%] z-30 flex justify-center">
      <div className="flex items-center gap-4 bg-linear-to-r from-transparent via-black/80 to-transparent px-24 py-3">
        <span className="text-5xl drop-shadow">⏫</span>
        <div className="italic">
          <div className="stroke text-4xl text-lime-300 sm:text-5xl">LEVEL UP!</div>
          <div className="stroke text-2xl sm:text-3xl">
            {levelUp.from} &gt;&gt; {levelUp.to}
          </div>
        </div>
      </div>
    </div>
  )
}
