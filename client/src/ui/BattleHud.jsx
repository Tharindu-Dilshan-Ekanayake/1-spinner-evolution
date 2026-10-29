import { useEffect, useRef, useState } from 'react'

import { C2S, WORLDS, formatNumber } from '@shared'

import { sfx } from '../audio/sfx'
import { send } from '../net/connection'
import { useGameStore } from '../store/gameStore'
import { live } from '../store/live'
import Icon from './kit/Icon'
import { ChunkyButton } from './kit/parts'
import StrokeText from './kit/StrokeText'
import { GRADIENTS, u } from './kit/style'

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

const VICTORY = 'linear-gradient(180deg, #ffffff 0%, #ffffff 50%, #ffe36b 51%, #ffb21e 100%)'
const DEFEAT = 'linear-gradient(180deg, #ffd0c8 0%, #ff6a55 50%, #d4142a 100%)'

function Result({ result }) {
  const won = result.result === 'win'
  const reward = result.reward || {}
  const title = won ? (result.finished ? 'WORLD CLEARED!' : 'VICTORY!') : result.result === 'timeout' ? "TIME'S UP!" : 'DEFEATED!'
  return (
    <div className="anim-reveal absolute left-1/2 top-[24%] flex -translate-x-1/2 flex-col items-center" style={{ gap: u(10) }}>
      <div style={{ fontSize: u(140), transform: 'rotate(-3deg)' }}>
        <StrokeText stroke={u(24)} gradient={won ? VICTORY : DEFEAT}>
          {title}
        </StrokeText>
      </div>
      {won && reward.wins > 0 && (
        <div className="flex items-center" style={{ fontSize: u(64), gap: u(10) }}>
          <Icon name="trophy" size={u(80)} />
          <StrokeText stroke={u(12)} gradient={GRADIENTS.gold}>
            +{formatNumber(reward.wins)} Wins
          </StrokeText>
        </div>
      )}
      {!won && (
        <div style={{ fontSize: u(40) }}>
          <StrokeText stroke={u(8)}>{result.run && result.run.wins > 0 ? "Your run's rewards were banked!" : 'Train more and try again!'}</StrokeText>
        </div>
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
  const stage = WORLDS[battle.world].firstStage + battle.stage - 1

  return (
    <>
      {!result && (
        <ChunkyButton
          gradient={GRADIENTS.redButton}
          onClick={() => send(C2S.giveUp)}
          title="Give Up"
          radius={18}
          border={5}
          className="absolute left-1/2 -translate-x-1/2"
          style={{ top: u(18), height: u(76), padding: `0 ${u(56)}` }}
        >
          <span style={{ fontSize: u(44) }}>
            <StrokeText stroke={u(9)}>Give Up</StrokeText>
          </span>
        </ChunkyButton>
      )}

      {/* Under the Give Up button: the top-left corner belongs to the platform's logos. */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: u(112), fontSize: u(38) }}>
        <StrokeText stroke={u(8)}>
          {WORLDS[battle.world]?.name} - Stage {stage}
        </StrokeText>
      </div>

      {counting && !result && (
        <div key={Math.ceil(s.countdown)} className="anim-reveal absolute left-1/2 top-[28%] -translate-x-1/2" style={{ fontSize: u(200) }}>
          <StrokeText stroke={u(30)} gradient={GRADIENTS.gold}>
            {Math.ceil(s.countdown)}
          </StrokeText>
        </div>
      )}

      {result && <Result result={result} />}

      {!result && (
        <div className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ bottom: u(22), width: `min(${u(960)}, 94vw)`, gap: u(10) }}>
          <div className="text-center" style={{ fontSize: u(48) }}>
            <StrokeText stroke={u(10)}>{counting ? 'Get ready...' : 'Click to boost your spinners!'}</StrokeText>
          </div>
          {s.boost > 0.02 && (
            <div className="relative overflow-hidden" style={{ width: '66%', height: u(24), border: `${u(4)} solid #111`, borderRadius: u(12), background: 'rgba(0,0,0,0.45)' }}>
              <div className="h-full" style={{ width: `${s.boost * 100}%`, background: GRADIENTS.barFill }} />
            </div>
          )}
          <div
            className="relative flex w-full overflow-hidden"
            style={{ height: u(84), borderRadius: u(42), border: `${u(6)} solid #0b2a6b`, boxShadow: `0 ${u(5)} 0 #0b2a6b`, background: '#eef6ff' }}
          >
            <div className="transition-[width] duration-200" style={{ width: `${100 - minePct}%`, background: GRADIENTS.redButton }} />
            <div className="flex-1" style={{ background: GRADIENTS.greenButton }} />
            <div className="absolute" style={{ left: u(18), right: u(18), top: u(6), height: u(14), borderRadius: u(8), background: 'rgba(255,255,255,0.35)' }} />
            <div className="absolute inset-0 flex items-center justify-between" style={{ padding: `0 ${u(30)}`, fontSize: u(40) }}>
              <StrokeText stroke={u(9)}>{formatNumber(s.theirs)} HP</StrokeText>
              <StrokeText stroke={u(9)} gradient={winning ? GRADIENTS.gold : GRADIENTS.priceShort}>
                {winning ? "YOU'RE WINNING!" : "YOU'RE LOSING!"}
              </StrokeText>
              <StrokeText stroke={u(9)}>{formatNumber(s.mine)} HP</StrokeText>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
