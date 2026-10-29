import { useState } from 'react'
import { createPortal } from 'react-dom'

import { useHudMode } from './kit/layout'

import { C2S, RARITIES, SPINNERS, computeStats, formatNumber, slotUnlocks, spinnerScore, spinnerStats } from '@shared'

import { useGameStore } from '../store/gameStore'
import { act } from './actions'
import { SpinnerIcon } from './common'
import Icon from './kit/Icon'
import { ChunkyButton } from './kit/parts'
import StrokeText from './kit/StrokeText'
import { GRADIENTS, u } from './kit/style'

/**
 * The team's slots, in a row over the level bar: every slot there is. Open ones show
 * the spinner in them (or a "+"), locked ones a lock and what unlocks them (Lv 5, Rebirth
 * 6). Click an open slot to choose which spinner goes in it.
 */

const UNLOCKS = slotUnlocks()
const SLOT = 68
/** On a portrait phone a reference pixel is ~0.42 real ones: the slots are drawn at least this many CSS px wide. */
const MIN_SLOT_PX = 42

/** A slot box. `tall` (portrait phone) floors the size at a finger-sized MIN_SLOT_PX. */
function slotStyle(border, bg, tall = false) {
  const size = tall ? `max(${MIN_SLOT_PX}px, ${u(SLOT)})` : u(SLOT)
  return {
    width: size,
    height: size,
    borderRadius: tall ? 10 : u(14),
    border: tall ? `3px solid ${border}` : `${u(5)} solid ${border}`,
    background: bg,
    boxShadow: `0 ${u(4)} 0 rgba(0,0,0,0.45)`,
  }
}

/** Above the slots: the spinners you own, to put in slot `slot` (0-based). */
function SlotPicker({ slot, onClose, tall }) {
  // Four cards across in portrait, six on a wide-but-short landscape phone.
  const cols = typeof window !== 'undefined' && window.innerWidth / window.innerHeight >= 1.25 ? 6 : 4
  const profile = useGameStore((s) => s.profile)
  const current = profile.equipped[slot]
  const spinners = [...profile.inventory].sort((a, b) => spinnerScore(b.id, b.golden) - spinnerScore(a.id, a.golden))
  const pick = (uid) => {
    if (uid !== current) act(C2S.equipSlot, { slot, uid })
    onClose()
  }
  const sheet = {
    background: GRADIENTS.panel,
    border: '5px solid #0b0c0e',
    borderRadius: 12,
  }
  // Drawn straight into the page, above the HUD: the bottom bar is positioned with a
  // transform, which would make "fixed" mean "inside the bar" instead of the screen.
  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: 60 }}>
      {/* Behind the picker: a tap anywhere else closes it (and keeps the game from being tapped through). */}
      <div className="pointer-events-auto absolute inset-0" style={{ background: tall ? 'rgba(0,0,0,0.45)' : 'transparent' }} onClick={onClose} />
      <div
        className="pp-font pointer-events-auto anim-fade"
        style={
          tall
            ? // A bottom sheet on a phone: full width, never taller than 62% of the visible screen.
              { ...sheet, position: 'absolute', left: 8, right: 8, bottom: 8, maxHeight: '62dvh', padding: 12, display: 'flex', flexDirection: 'column', borderRadius: 14 }
            : // Over the bottom bar on a computer.
              { ...sheet, position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: u(245), width: `min(${u(860)}, 94vw)`, padding: u(16) }
        }
      >
        <div className="flex shrink-0 items-center justify-between" style={{ marginBottom: tall ? 8 : u(10), fontSize: tall ? 20 : u(36) }}>
          <StrokeText stroke={tall ? 4 : u(7)}>Slot {slot + 1}: pick a spinner</StrokeText>
          <button type="button" className="gbtn g-red stroke" style={tall ? { width: 40, height: 40, fontSize: 20 } : { width: u(56), height: u(56), fontSize: u(32) }} onClick={onClose} title="Close">
            ✕
          </button>
        </div>
        <div className="grid min-h-0 overflow-y-auto" style={{ gridTemplateColumns: tall ? `repeat(${cols}, minmax(0, 1fr))` : `repeat(auto-fill, minmax(${u(132)}, 1fr))`, gap: tall ? 6 : u(10), maxHeight: tall ? undefined : '34dvh' }}>
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
                style={{ ...slotStyle(r.color || '#ffffff', at === slot ? 'rgba(120,255,120,0.25)' : 'rgba(255,255,255,0.08)', tall), width: '100%', height: 'auto', padding: tall ? 3 : u(6) }}
              >
                {at >= 0 && (
                  <span className="stroke-sm absolute rounded-full bg-green-600" style={tall ? { top: -7, right: -5, fontSize: 10, padding: '0 5px' } : { top: u(-10), right: u(-8), fontSize: u(18), padding: `0 ${u(8)}` }}>
                    Slot {at + 1}
                  </span>
                )}
                <SpinnerIcon id={s.id} golden={s.golden} size={tall ? 40 : u(64)} />
                <span className="w-full truncate" style={{ fontSize: tall ? 11 : u(20) }}>
                  <StrokeText stroke={tall ? 3 : u(5)}>{def.name}</StrokeText>
                </span>
                <span className="stroke-sm" style={{ fontSize: tall ? 10 : u(18) }}>
                  ⚔️ {formatNumber(spinnerStats(s.id, s.golden).dmg)}
                </span>
              </button>
            )
          })}
        </div>
        {current !== undefined && profile.equipped.length > 1 && (
          <div className="flex shrink-0 justify-center" style={{ marginTop: tall ? 8 : u(10) }}>
            <button
              type="button"
              className="gbtn g-gray stroke"
              style={tall ? { fontSize: 15, padding: '6px 18px' } : { fontSize: u(26), padding: `${u(6)} ${u(24)}` }}
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
    </div>,
    document.body,
  )
}

const FOLD_KEY = 'spinner_slots_hidden'
const readHidden = () => {
  try {
    return localStorage.getItem(FOLD_KEY) === '1'
  } catch {
    return false
  }
}

export default function TeamSlots() {
  const profile = useGameStore((s) => s.profile)
  // Any phone layout (portrait 'tall' or landscape 'short'): finger-sized slots, bottom-sheet picker.
  const tall = useHudMode() !== 'wide'
  const [open, setOpen] = useState(null)
  // On a phone the slots can be tucked away with a button (it remembers your choice).
  const [hidden, setHidden] = useState(readHidden)
  const fold = () => {
    const next = !hidden
    setHidden(next)
    setOpen(null)
    try {
      localStorage.setItem(FOLD_KEY, next ? '1' : '0')
    } catch {
      /* private mode: it just won't be remembered */
    }
  }
  const slots = computeStats(profile).slots
  const byUid = new Map(profile.inventory.map((s) => [s.uid, s]))
  // Still-locked slots, the level ones first: whatever this player hasn't reached yet.
  const locked = UNLOCKS.filter((x) => (x.level ? profile.level < x.level : profile.rebirths < x.rebirths)).slice(0, Math.max(0, UNLOCKS.length - slots))
  const toggle = (i) => setOpen((o) => (o === i ? null : i))
  const box = (border, bg) => slotStyle(border, bg, tall)

  const folded = tall && hidden
  return (
    <div className="flex flex-col items-center" style={{ gap: 4, maxWidth: '100%' }}>
      {tall && (
        // The game's chunky button (glossy gradient, black outline), in fixed phone sizes
        // (the HUD unit would shrink it to nothing here): blue to hide, gold to show again.
        <ChunkyButton
          gradient={folded ? GRADIENTS.goldButton : GRADIENTS.skyButton}
          onClick={fold}
          title={folded ? 'Show your team slots' : 'Hide your team slots'}
          style={{ height: 34, padding: '0 16px 0 12px', gap: 7, border: '3px solid #111', borderRadius: 17, boxShadow: '0 3px 0 rgba(0,0,0,0.5)' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" style={{ position: 'relative', transform: folded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <path d="M3 5.5 8 10.5 13 5.5" fill="none" stroke="#111" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 5.5 8 10.5 13 5.5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="relative" style={{ fontSize: 15, lineHeight: 1 }}>
            <StrokeText stroke={4}>{folded ? `Team (${slots})` : 'Hide team'}</StrokeText>
          </span>
        </ChunkyButton>
      )}
      {!folded && (
    // On a phone the slots wrap onto a second row (11 of them don't fit one at a finger-sized width).
    <div className={`pointer-events-auto relative flex items-center justify-center ${tall ? 'flex-wrap' : 'flex-nowrap'}`} style={{ gap: tall ? 4 : u(6), maxWidth: '100%' }}>
      {open !== null && open < slots && <SlotPicker slot={open} onClose={() => setOpen(null)} tall={tall} />}
      {Array.from({ length: slots }, (_, i) => {
        const item = byUid.get(profile.equipped[i])
        if (!item) {
          return (
            <button key={i} type="button" title="Empty slot: put a spinner in" onClick={() => toggle(i)} className="flex items-center justify-center" style={{ ...box('rgba(255,255,255,0.75)', 'rgba(255,255,255,0.12)'), borderStyle: 'dashed', fontSize: tall ? 24 : u(46) }}>
              <StrokeText stroke={tall ? 4 : u(8)}>+</StrokeText>
            </button>
          )
        }
        const r = RARITIES[SPINNERS[item.id].rarity] || RARITIES.common
        return (
          <button key={i} type="button" title={`${SPINNERS[item.id].name}: click to change`} onClick={() => toggle(i)} className="relative flex items-center justify-center" style={box(open === i ? '#ffffff' : r.color || '#ffffff', 'rgba(16,20,40,0.55)')}>
            <SpinnerIcon id={item.id} golden={item.golden} size={tall ? 30 : u(54)} />
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
          style={{ ...box('#2a2f3a', 'rgba(20,22,30,0.7)'), gap: tall ? 0 : u(2), lineHeight: 1 }}
        >
          <Icon name="lock" size={tall ? 14 : u(x.level ? 28 : 22)} />
          {x.level ? (
            <span style={{ fontSize: tall ? 10 : u(18) }}>
              <StrokeText stroke={tall ? 3 : u(4)}>Lv {x.level}</StrokeText>
            </span>
          ) : (
            <>
              <span style={{ fontSize: tall ? 7 : u(12) }}>
                <StrokeText stroke={tall ? 2 : u(3)}>Rebirth</StrokeText>
              </span>
              <span style={{ fontSize: tall ? 10 : u(17) }}>
                <StrokeText stroke={tall ? 3 : u(4)}>{x.rebirths}</StrokeText>
              </span>
            </>
          )}
        </button>
      ))}
    </div>
      )}
    </div>
  )
}
