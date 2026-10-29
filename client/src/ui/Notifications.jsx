import { POTIONS, formatNumber } from '@shared'

import { useEffect, useRef } from 'react'

import { sfx } from '../audio/sfx'
import { useGameStore } from '../store/gameStore'
import Icon from './kit/Icon'
import { iconUrl } from './kit/icons'
import StrokeText from './kit/StrokeText'
import { GRADIENTS, u } from './kit/style'

const TOAST_ACCENT = {
  error: '#ff5468',
  info: '#4cb8ff',
  rebirth: '#c77dff',
}

/** Short messages across the top, as the same dark glass cards as the rest of the HUD. */
export function Toasts() {
  const toasts = useGameStore((s) => s.toasts)
  return (
    <div className="pp-font pointer-events-none absolute left-1/2 z-30 flex w-[min(92vw,640px)] -translate-x-1/2 flex-col items-center" style={{ top: u(110), gap: u(10) }}>
      {toasts.map((t) => (
        <div key={t.id} className="pp-glass anim-fade text-center" style={{ '--accent': TOAST_ACCENT[t.kind] || TOAST_ACCENT.info, padding: `${u(10)} ${u(30)}`, borderRadius: u(22) }}>
          <span className="pp-glass-title" style={{ fontSize: u(28) }}>
            {t.text}
          </span>
        </div>
      ))}
    </div>
  )
}

const POTION_ICONS = { power: 'potionPower', wins: 'potionWins', lucky: 'potionLucky' }

function rewardLines(reward) {
  const lines = []
  if (reward?.wins) lines.push({ text: `+${formatNumber(reward.wins)} WINS!`, gradient: GRADIENTS.gold, icon: 'trophy' })
  if (reward?.potion) lines.push({ text: `+1 ${POTIONS[reward.potion].name.toUpperCase()} POTION`, gradient: GRADIENTS.blueButton, icon: POTION_ICONS[reward.potion] })
  return lines
}

/** Confetti pieces of the win celebration: angle, distance, colour (fixed, no per-render random). */
const CONFETTI = Array.from({ length: 26 }, (_, i) => {
  const a = (i / 26) * Math.PI * 2 + (i % 3) * 0.2
  const r = 170 + ((i * 53) % 110)
  return { dx: Math.cos(a) * r, dy: Math.sin(a) * r * 0.75 - 40, color: ['#ffd23a', '#ff4f8b', '#4fd6ff', '#7dff4a', '#b45cff', '#ffffff'][i % 6], rot: (i * 77) % 360 }
})

const RAYS = 'repeating-conic-gradient(from 0deg, rgba(255,236,120,0.85) 0deg 9deg, transparent 9deg 22deg)'
const RAY_MASK = 'radial-gradient(circle, #000 25%, transparent 68%)'

/** A win worth celebrating: rays, confetti, a big trophy and the amount, in the middle. */
function Celebration({ r, lines }) {
  return (
    <div className="anim-celebrate absolute left-1/2 top-0 flex flex-col items-center">
      <span className="pp-spin pointer-events-none absolute rounded-full" style={{ width: u(460), height: u(460), top: u(-150), background: RAYS, maskImage: RAY_MASK, WebkitMaskImage: RAY_MASK }} />
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className="anim-confetti pointer-events-none absolute"
          style={{ top: u(40), width: u(18), height: u(26), borderRadius: u(4), background: c.color, border: `${u(2)} solid rgba(0,0,0,0.35)`, '--dx': u(c.dx), '--dy': u(c.dy), '--rot': `${c.rot}deg` }}
        />
      ))}
      <Icon name="trophy" size={u(150)} className="relative" />
      {r.label && (
        <div className="relative whitespace-nowrap" style={{ fontSize: u(40), marginTop: u(-6) }}>
          <StrokeText stroke={u(9)}>{r.label}</StrokeText>
        </div>
      )}
      {lines.map((l) => (
        <div key={l.text} className="relative flex items-center whitespace-nowrap" style={{ fontSize: u(84), gap: u(10) }}>
          <StrokeText stroke={u(15)} gradient={l.gradient}>
            {l.text}
          </StrokeText>
        </div>
      ))}
      {r.run && (
        <div className="relative whitespace-nowrap" style={{ fontSize: u(36) }}>
          <StrokeText stroke={u(8)} fill="#9dff6a">
            Keep going for more!
          </StrokeText>
        </div>
      )}
    </div>
  )
}

/**
 * Rewards in the middle of the screen. Wins get a celebration (and fly to the Wins
 * counter, see WinsFlight); smaller rewards (quests, potions) a line that floats up.
 */
export function Rewards() {
  const rewards = useGameStore((s) => s.rewards)
  // A capsule reveal has the middle of the screen to itself.
  const opening = useGameStore((s) => Boolean(s.opening))
  // The big celebration is for wins brought home from the stages; quest and gift wins
  // get a line (and still fly to the counter).
  const big = [...rewards].reverse().find((r) => r.reward?.wins && r.run)
  return (
    <div className="pp-font pointer-events-none absolute inset-x-0 top-[24%] z-30 flex justify-center">
      <div className="relative w-0">
        {big && <Celebration key={big.id} r={big} lines={rewardLines(big.reward)} />}
        {rewards
          .filter((r) => r !== big && !opening)
          .map((r, i) => {
            const lines = rewardLines(r.reward)
            if (!lines.length && !r.text) return null
            return (
              <div key={r.id} className="absolute left-0 top-0" style={{ transform: `translate(-50%, ${u(big ? 430 + i * 90 : 120 + i * 90)})` }}>
                <div className="anim-reward flex flex-col items-center whitespace-nowrap">
                  {r.label && (
                    <div style={{ fontSize: u(34) }}>
                      <StrokeText stroke={u(8)}>{r.label}</StrokeText>
                    </div>
                  )}
                  {r.text && (
                    <div style={{ fontSize: u(28) }}>
                      <StrokeText stroke={u(7)} fill="#9dff6a">
                        {r.text}
                      </StrokeText>
                    </div>
                  )}
                  {lines.map((l) => (
                    <div key={l.text} className="flex items-center" style={{ fontSize: u(46), gap: u(10) }}>
                      <Icon name={l.icon} size="1.15em" />
                      <StrokeText stroke={u(9)} gradient={l.gradient}>
                        {l.text}
                      </StrokeText>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}

/**
 * New wins fly from the middle of the screen into the Wins counter, which counts up as
 * each trophy lands (the store's winsInFlight holds back what is still flying).
 * Driven by the Web Animations API: no React renders while they fly.
 */
export function WinsFlight() {
  const layer = useRef(null)
  const seen = useRef(new Set())
  const rewards = useGameStore((s) => s.rewards)
  useEffect(() => {
    const host = layer.current
    for (const r of rewards) {
      const amount = r.reward?.wins || 0
      if (seen.current.has(r.id) || amount <= 0) continue
      seen.current.add(r.id)
      const target = document.querySelector('[data-wins-counter]')
      if (!host || !target) continue
      const to = target.getBoundingClientRect()
      const box = host.getBoundingClientRect()
      const count = Math.min(12, 3 + Math.floor(Math.log2(amount + 1)))
      useGameStore.setState((st) => ({ winsInFlight: st.winsInFlight + amount }))
      let left = amount
      for (let i = 0; i < count; i += 1) {
        const share = i === count - 1 ? left : Math.floor(amount / count)
        left -= share
        const img = document.createElement('img')
        img.src = iconUrl('trophy')
        img.alt = ''
        img.className = 'pointer-events-none absolute'
        const size = Math.max(28, to.height * 0.8)
        Object.assign(img.style, { width: `${size}px`, height: `${size}px`, left: '0px', top: '0px', opacity: '0' })
        host.appendChild(img)
        const sx = box.width / 2 + (Math.random() - 0.5) * 160 - size / 2
        const sy = box.height * 0.34 + (Math.random() - 0.5) * 90 - size / 2
        const ex = to.left - box.left + to.height * 0.1
        const ey = to.top - box.top + to.height * 0.1
        const mx = (sx + ex) / 2 + (Math.random() - 0.5) * 200
        const my = Math.min(sy, ey) - 60 - Math.random() * 80
        const anim = img.animate(
          [
            { transform: `translate(${sx}px, ${sy}px) scale(0.4)`, opacity: 0 },
            { transform: `translate(${sx}px, ${sy - 30}px) scale(1.3)`, opacity: 1, offset: 0.18 },
            { transform: `translate(${mx}px, ${my}px) scale(1.1)`, opacity: 1, offset: 0.55 },
            { transform: `translate(${ex}px, ${ey}px) scale(0.7)`, opacity: 1 },
          ],
          { duration: 1100, delay: 450 + i * 70, easing: 'cubic-bezier(0.45, 0, 0.6, 1)', fill: 'backwards' },
        )
        anim.onfinish = () => {
          img.remove()
          useGameStore.setState((st) => ({ winsInFlight: Math.max(0, st.winsInFlight - share) }))
          target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 180 })
          if (i % 3 === 0) sfx.click()
        }
      }
    }
  }, [rewards])
  return <div ref={layer} className="pointer-events-none absolute inset-0 z-30 overflow-hidden" />
}

/** The sliding "LEVEL UP! 1 >> 2" banner. */
export function LevelUpBanner() {
  const levelUp = useGameStore((s) => s.levelUp)
  if (!levelUp) return null
  return (
    <div key={levelUp.at} className="pp-font anim-banner pointer-events-none absolute left-0 right-0 top-[18%] z-30 flex justify-center">
      <div className="flex items-center bg-linear-to-r from-transparent via-black/70 to-transparent" style={{ gap: u(20), padding: `${u(14)} ${u(140)}` }}>
        <Icon name="starGold" size={u(110)} />
        <div className="flex flex-col italic leading-none" style={{ gap: u(6) }}>
          <span style={{ fontSize: u(80) }}>
            <StrokeText stroke={u(15)} gradient={GRADIENTS.greenButton}>
              LEVEL UP!
            </StrokeText>
          </span>
          <span style={{ fontSize: u(48) }}>
            <StrokeText stroke={u(10)}>
              {levelUp.from} &gt;&gt; {levelUp.to}
            </StrokeText>
          </span>
        </div>
      </div>
    </div>
  )
}
