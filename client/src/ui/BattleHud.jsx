import { useEffect, useRef, useState } from 'react'

import { C2S, WORLDS, formatNumber } from '@shared'

import { sfx } from '../audio/sfx'
import { send } from '../net/connection'
import { useGameStore } from '../store/gameStore'
import { live } from '../store/live'

/** Samples the live battle 10x a second (the HUD doesn't need 60 updates). */
function useBattleSample() {
  const [s, setS] = useState({ mine: 1, theirs: 1, maxMine: 1, maxTheirs: 1, boost: 0, countdown: 3 })
  const lastBeep = useRef(4)
  useEffect(() => {
    const t = setInterval(() => {
      const b = live.battle
      if (!b) return
      const elapsed = (performance.now() - b.startAt) / 1000
      const left = Math.ceil(b.countdown - elapsed)
      if (left !== lastBeep.current && left >= 0 && left <= 3) {
        lastBeep.current = left
        sfx.countdown(left === 0)
      }
      setS({
        mine: b.mine || b.maxMine,
        theirs: b.theirs || (b.time > 0 ? 0 : b.maxTheirs),
        maxMine: b.maxMine,
        maxTheirs: b.maxTheirs,
        boost: b.boost,
        countdown: b.countdown - elapsed,
      })
    }, 100)
    return () => clearInterval(t)
  }, [])
  return s
}

function Result({ result }) {
  const won = result.result === 'win'
  const reward = result.reward || {}
  return (
    <div className="anim-reveal absolute left-1/2 top-[26%] -translate-x-1/2 text-center">
      <div className={`stroke text-5xl sm:text-7xl ${won ? 'text-yellow-300' : 'text-red-400'}`}>
        {won ? (result.finished ? 'WORLD CLEARED!' : 'VICTORY!') : result.result === 'timeout' ? "TIME'S UP!" : 'Your army was defeated!'}
      </div>
      {won && reward.wins > 0 && <div className="stroke mt-1 text-4xl text-yellow-300">🏆 +{formatNumber(reward.wins)} Wins</div>}
      {won && reward.candy > 0 && <div className="stroke mt-1 text-4xl text-orange-300">🍬 +{formatNumber(reward.candy)} Candy</div>}
      {!won && result.run && (result.run.wins > 0 || result.run.candy > 0) && (
        <div className="stroke mt-1 text-2xl">Your run's rewards were banked!</div>
      )}
    </div>
  )
}

export default function BattleHud() {
  const battle = useGameStore((s) => s.battle)
  const result = useGameStore((s) => s.battleResult)
  const s = useBattleSample()
  const total = s.mine + s.theirs || 1
  const minePct = (s.mine / total) * 100
  // Compare how much of each army is left, not raw HP (armies differ in size).
  const winning = s.mine / Math.max(1, s.maxMine) >= s.theirs / Math.max(1, s.maxTheirs)
  const counting = s.countdown > 0

  return (
    <>
      {!result && (
        <button
          type="button"
          className="gbtn g-red stroke pointer-events-auto absolute left-1/2 top-3 -translate-x-1/2 px-10 py-1 text-3xl"
          onClick={() => {
            sfx.click()
            send(C2S.giveUp)
          }}
        >
          Give Up
        </button>
      )}

      <div className="stroke absolute left-3 top-3 text-lg sm:text-2xl">
        {WORLDS[battle.world]?.name} — Stage {battle.world === 'halloween' ? battle.stage : WORLDS[battle.world].firstStage + battle.stage - 1}
      </div>

      {counting && !result && (
        <div key={Math.ceil(s.countdown)} className="stroke anim-reveal absolute left-1/2 top-[30%] -translate-x-1/2 text-8xl text-yellow-300">
          {Math.ceil(s.countdown)}
        </div>
      )}

      {result && <Result result={result} />}

      {!result && (
        <div className="absolute bottom-3 left-1/2 w-[min(94vw,640px)] -translate-x-1/2">
          <div className="stroke mb-2 text-center text-2xl sm:text-4xl">
            {counting ? 'Get ready...' : 'Click 🖱️ to boost your spinners!'}
          </div>
          {s.boost > 0.02 && (
            <div className="mx-auto mb-1 h-3 w-2/3 overflow-hidden rounded-full border-2 border-black/70 bg-black/40">
              <div className="h-full bg-linear-to-r from-yellow-300 to-orange-500" style={{ width: `${s.boost * 100}%` }} />
            </div>
          )}
          <div className="relative flex h-12 overflow-hidden rounded-lg border-4 border-black/80 sm:h-14">
            <div className="bg-linear-to-b from-red-400 to-red-600 transition-[width] duration-200" style={{ width: `${100 - minePct}%` }} />
            <div className="flex-1 bg-linear-to-b from-lime-300 to-green-500" />
            <div className="absolute inset-0 flex items-center justify-between px-3">
              <span className="stroke text-xl sm:text-3xl">{formatNumber(s.theirs)} HP</span>
              <span className={`stroke text-xl sm:text-3xl ${winning ? 'text-yellow-200' : 'text-red-200'}`}>
                {winning ? "YOU'RE WINNING!" : "YOU'RE LOSING!"}
              </span>
              <span className="stroke text-xl sm:text-3xl">{formatNumber(s.mine)} HP</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
