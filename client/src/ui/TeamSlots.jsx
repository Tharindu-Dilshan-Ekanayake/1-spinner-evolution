import { useState } from 'react'

import { C2S, RARITIES, SPINNERS, computeStats, formatNumber, slotUnlocks, spinnerScore, spinnerStats } from '@shared'

import { useGameStore } from '../store/gameStore'
import { act } from './actions'
import { SpinnerIcon } from './common'
import Icon from './kit/Icon'
import StrokeText from './kit/StrokeText'
import { GRADIENTS, u } from './kit/style'

/**
 * The team's slots, in a row over the level bar: every slot there is. Open ones show
 * the spinner in them (or a "+"), locked ones a lock and what unlocks them (Lv 5, Rebirth
 * 6). Click an open slot to choose which spinner goes in it.
 */

const UNLOCKS = slotUnlocks()
const SLOT = 68

function slotStyle(border, bg) {
  return {
    width: u(SLOT),
    height: u(SLOT),
    borderRadius: u(14),
    border: `${u(5)} solid ${border}`,
    background: bg,
    boxShadow: `0 ${u(4)} 0 rgba(0,0,0,0.45)`,
  }
}

/** Above the slots: the spinners you own, to put in slot `slot` (0-based). */
function SlotPicker({ slot, onClose }) {
  const profile = useGameStore((s) => s.profile)
  const current = profile.equipped[slot]
  const spinners = [...profile.inventory].sort((a, b) => spinnerScore(b.id, b.golden) - spinnerScore(a.id, a.golden))
  const pick = (uid) => {
    if (uid !== current) act(C2S.equipSlot, { slot, uid })
    onClose()
  }
  return (
    <div
      className="pp-font pointer-events-auto absolute left-1/2 -translate-x-1/2 anim-fade"
      style={{ bottom: `calc(100% + ${u(16)})`, width: `min(${u(860)}, 94vw)`, background: GRADIENTS.panel, border: '5px solid #0b0c0e', borderRadius: 12, padding: u(16) }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: u(10), fontSize: u(36) }}>
        <StrokeText stroke={u(7)}>Slot {slot + 1}: pick a spinner</StrokeText>
        <button type="button" className="gbtn g-red stroke" style={{ width: u(56), height: u(56), fontSize: u(32) }} onClick={onClose} title="Close">
          ✕
        </button>
      </div>
      <div className="grid overflow-y-auto" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${u(132)}, 1fr))`, gap: u(10), maxHeight: '34vh' }}>
        {spinners.map((s) => {
          const def = SPINNERS[s.id]
          const r = RARITIES[def.rarity] || RARITIES.common
          const at = profile.equipped.indexOf(s.uid)
          return (
            <button
              key={s.uid}
              type="button"
              onClick={() => pick(s.uid)}
              className="relative flex flex-col items-center"
              style={{ ...slotStyle(r.color || '#ffffff', at === slot ? 'rgba(120,255,120,0.25)' : 'rgba(255,255,255,0.08)'), width: '100%', height: 'auto', padding: u(6) }}
            >
              {at >= 0 && (
                <span className="stroke-sm absolute rounded-full bg-green-600" style={{ top: u(-10), right: u(-8), fontSize: u(18), padding: `0 ${u(8)}` }}>
                  Slot {at + 1}
                </span>
              )}
              <SpinnerIcon id={s.id} golden={s.golden} size={u(64)} />
              <span className="w-full truncate" style={{ fontSize: u(20) }}>
                <StrokeText stroke={u(5)}>{def.name}</StrokeText>
              </span>
              <span className="stroke-sm" style={{ fontSize: u(18) }}>
                ⚔️ {formatNumber(spinnerStats(s.id, s.golden).dmg)}
              </span>
            </button>
          )
        })}
      </div>
      {current !== undefined && profile.equipped.length > 1 && (
        <div className="flex justify-center" style={{ marginTop: u(10) }}>
          <button
            type="button"
            className="gbtn g-gray stroke"
            style={{ fontSize: u(26), padding: `${u(6)} ${u(24)}` }}
            onClick={() => {
              act(C2S.unequip, { uid: current })
              onClose()
            }}
          >
            Take it out of the team
          </button>
        </div>
      )}
    </div>
  )
}

export default function TeamSlots() {
  const profile = useGameStore((s) => s.profile)
  const [open, setOpen] = useState(null)
  const slots = computeStats(profile).slots
  const byUid = new Map(profile.inventory.map((s) => [s.uid, s]))
  // Still-locked slots, the level ones first: whatever this player hasn't reached yet.
  const locked = UNLOCKS.filter((x) => (x.level ? profile.level < x.level : profile.rebirths < x.rebirths)).slice(0, Math.max(0, UNLOCKS.length - slots))
  const toggle = (i) => setOpen((o) => (o === i ? null : i))

  return (
    <div className="pointer-events-auto relative flex flex-nowrap items-center justify-center" style={{ gap: u(6) }}>
      {open !== null && open < slots && <SlotPicker slot={open} onClose={() => setOpen(null)} />}
      {Array.from({ length: slots }, (_, i) => {
        const item = byUid.get(profile.equipped[i])
        if (!item) {
          return (
            <button key={i} type="button" title="Empty slot: put a spinner in" onClick={() => toggle(i)} className="flex items-center justify-center" style={{ ...slotStyle('rgba(255,255,255,0.75)', 'rgba(255,255,255,0.12)'), borderStyle: 'dashed', fontSize: u(46) }}>
              <StrokeText stroke={u(8)}>+</StrokeText>
            </button>
          )
        }
        const r = RARITIES[SPINNERS[item.id].rarity] || RARITIES.common
        return (
          <button key={i} type="button" title={`${SPINNERS[item.id].name}: click to change`} onClick={() => toggle(i)} className="relative flex items-center justify-center" style={slotStyle(open === i ? '#ffffff' : r.color || '#ffffff', 'rgba(16,20,40,0.55)')}>
            <SpinnerIcon id={item.id} golden={item.golden} size={u(54)} />
          </button>
        )
      })}
      {locked.map((x, i) => (
        <button
          key={`lock${i}`}
          type="button"
          title={`Unlocks at ${x.level ? `Level ${x.level}` : `Rebirth ${x.rebirths}`}`}
          onClick={() => useGameStore.getState().toast(`This slot unlocks at ${x.level ? `Level ${x.level}: train to level up!` : `Rebirth ${x.rebirths}!`}`)}
          // Everything stays inside the box: "Rebirth" and its number get a line each.
          className="flex flex-col items-center justify-center overflow-hidden whitespace-nowrap"
          style={{ ...slotStyle('#2a2f3a', 'rgba(20,22,30,0.7)'), gap: u(2), lineHeight: 1 }}
        >
          <Icon name="lock" size={u(x.level ? 28 : 22)} />
          {x.level ? (
            <span style={{ fontSize: u(18) }}>
              <StrokeText stroke={u(4)}>Lv {x.level}</StrokeText>
            </span>
          ) : (
            <>
              <span style={{ fontSize: u(12) }}>
                <StrokeText stroke={u(3)}>Rebirth</StrokeText>
              </span>
              <span style={{ fontSize: u(17) }}>
                <StrokeText stroke={u(4)}>{x.rebirths}</StrokeText>
              </span>
            </>
          )}
        </button>
      ))}
    </div>
  )
}
