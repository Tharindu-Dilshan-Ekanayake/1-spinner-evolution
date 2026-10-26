import { C2S, DAILY_REWARDS, GIFTS, POTIONS, formatNumber, resolveReward } from '@shared'

import { useNow } from '../../store/clock'
import { useGameStore } from '../../store/gameStore'
import { act, formatTime, giftSeconds } from '../actions'
import { Panel } from '../common'

function RewardText({ reward }) {
  const parts = []
  if (reward.wins) parts.push(`🏆 ${formatNumber(reward.wins)}`)
  if (reward.candy) parts.push(`🍬 ${reward.candy}`)
  if (reward.potion) parts.push(`${POTIONS[reward.potion].icon} ${POTIONS[reward.potion].name}`)
  return <span>{parts.join(' + ')}</span>
}

/** Playtime gifts (today's minutes played) and the 7-day login streak. */
export default function GiftsPanel() {
  const profile = useGameStore((s) => s.profile)
  const daily = useGameStore((s) => s.daily)
  const close = useGameStore((s) => s.closePanel)
  const giftsAt = useGameStore((s) => s.giftsAt)
  const now = useNow()
  const seconds = giftSeconds(profile, now, giftsAt)
  const claimed = profile.gifts.claimed || []

  return (
    <Panel title="Free Gifts" icon="🎁" color="g-green" wide onClose={close}>
      <div className="stroke mb-2 text-center text-lg">Play to unlock gifts! Played today: {formatTime(seconds)}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {GIFTS.map((g) => {
          const done = claimed.includes(g.id)
          const ready = !done && seconds >= g.minutes * 60
          return (
            <div key={g.id} className={`flex flex-col items-center rounded-xl border-4 border-black/60 p-2 text-center ${ready ? 'g-yellow anim-glow' : done ? 'bg-green-700/40' : 'bg-white/10'}`}>
              <span className="text-4xl">{done ? '✅' : '🎁'}</span>
              <div className="stroke-sm text-sm leading-tight">
                <RewardText reward={resolveReward(g.reward, profile)} />
              </div>
              {done ? (
                <span className="stroke text-sm">Claimed</span>
              ) : ready ? (
                <button type="button" className="gbtn g-green stroke mt-1 px-3 text-lg" onClick={() => act(C2S.claimGift, { id: g.id })}>
                  Claim
                </button>
              ) : (
                <span className="stroke mt-1 text-lg">{formatTime(g.minutes * 60 - seconds)}</span>
              )}
            </div>
          )
        })}
      </div>

      <div className="stroke mb-1 mt-4 text-center text-2xl">📅 Daily Rewards</div>
      <div className="stroke-sm mb-2 text-center text-sm">Come back every day — the streak resets if you miss one!</div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {DAILY_REWARDS.map((d) => {
          const streak = daily?.streak || 0
          const today = daily?.canClaim && daily.nextDay === d.day
          const done = d.day <= (daily?.canClaim ? daily.nextDay - 1 : ((streak - 1) % DAILY_REWARDS.length) + 1)
          return (
            <div key={d.day} className={`flex flex-col items-center rounded-xl border-4 border-black/60 p-1 text-center ${today ? 'g-pink anim-glow' : done ? 'bg-green-700/40' : 'bg-white/10'}`}>
              <span className="stroke text-lg">Day {d.day}</span>
              <span className="stroke-sm text-xs leading-tight">
                <RewardText reward={resolveReward(d.reward, profile)} />
              </span>
              {today && (
                <button type="button" className="gbtn g-green stroke mt-1 px-2 text-base" onClick={() => act(C2S.claimDaily)}>
                  Claim
                </button>
              )}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
