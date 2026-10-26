import { useEffect } from 'react'

import {
  C2S,
  GIFTS,
  POTIONS,
  computeStats,
  formatNumber,
  hasPerk,
  levelNeed,
  nextSlotLevel,
  rebirthLevelReq,
} from '@shared'

import { sfx } from '../audio/sfx'
import { useNow } from '../store/clock'
import { useGameStore } from '../store/gameStore'
import BattleHud from './BattleHud'
import CapsuleOpening from './CapsuleOpening'
import { act, formatTime, giftSeconds } from './actions'
import NearbyPrompt from './NearbyPrompt'
import AurasPanel from './panels/AurasPanel'
import EventPanel from './panels/EventPanel'
import GiftsPanel from './panels/GiftsPanel'
import RebirthPanel from './panels/RebirthPanel'
import SettingsPanel from './panels/SettingsPanel'
import ShopPanel from './panels/ShopPanel'
import SpinnersPanel from './panels/SpinnersPanel'
import TrailsPanel from './panels/TrailsPanel'
import WorldsPanel from './panels/WorldsPanel'
import { LevelUpBanner, Rewards, Toasts } from './Notifications'

function openPanel(name) {
  sfx.open()
  useGameStore.getState().setPanel(name)
}


/* ---------------------------------------------------------------------------
 * Top: quest
 * ------------------------------------------------------------------------- */

function QuestBar() {
  const quest = useGameStore((s) => s.quest)
  if (!quest) return null
  const pct = Math.min(100, (quest.progress / Math.max(1, quest.target)) * 100)
  return (
    // Top-left, out of the way of the door displays at the top of the view.
    <div className="absolute left-2 top-2 w-[min(46vw,330px)] rounded-xl border-4 border-black/70 bg-[#1d2140]/90 px-3 py-1.5 shadow-lg">
      <div className="stroke truncate text-sm leading-tight sm:text-base" title={quest.text}>
        📜 {quest.text}
      </div>
      <div className="relative mt-1 h-4 w-full overflow-hidden rounded-full border-2 border-black/80 bg-[#2a2a3a]">
        <div className="h-full rounded-full bg-linear-to-b from-yellow-300 to-orange-500 transition-all duration-500" style={{ width: `${pct}%` }} />
        <div className="stroke-sm absolute inset-0 text-center text-xs leading-3">
          {formatNumber(quest.progress)}/{formatNumber(quest.target)}
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Left: menu tiles + currencies
 * ------------------------------------------------------------------------- */

function Tile({ icon, label, color, onClick, badge, big = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`gbtn ${color} studs relative flex flex-col items-center justify-end ${big ? 'h-[74px] w-[148px] sm:h-[88px] sm:w-[176px]' : 'h-[70px] w-[70px] sm:h-[84px] sm:w-[84px]'}`}
    >
      <span className={`${big ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'} -mb-1 drop-shadow-[0_3px_0_rgba(0,0,0,0.4)]`}>{icon}</span>
      <span className="stroke pb-1 text-sm sm:text-lg">{label}</span>
      {badge != null && (
        <span className="stroke-sm absolute -right-2 -top-2 rounded-md border-2 border-black/70 bg-yellow-400 px-1 text-xs text-white sm:text-sm">
          {badge}
        </span>
      )}
    </button>
  )
}

function LeftMenu() {
  const profile = useGameStore((s) => s.profile)
  const need = rebirthLevelReq(profile.rebirths)
  const pct = Math.min(100, Math.floor((profile.level / need) * 100))
  return (
    <div className="pointer-events-auto absolute left-2 top-[86px] flex flex-col gap-2 sm:top-24">
      <Tile big icon="🛒" label="Shop" color="g-red" onClick={() => openPanel('shop')} />
      <div className="grid grid-cols-2 gap-2">
        <Tile icon="🔄" label="Rebirth" color="g-purple" badge={`${pct}%`} onClick={() => openPanel('rebirth')} />
        <Tile icon="🌀" label="Spinners" color="g-orange" onClick={() => openPanel('spinners')} />
        <Tile icon="⭐" label="Auras" color="g-blue" onClick={() => openPanel('auras')} />
        <Tile icon="💫" label="Trails" color="g-green" onClick={() => openPanel('trails')} />
      </div>
    </div>
  )
}

function Currency({ icon, value, color }) {
  return (
    <div className="flex items-center gap-2 rounded-r-full bg-linear-to-r from-[#141833]/95 to-transparent py-0.5 pl-2 pr-10">
      <span className="text-2xl sm:text-3xl">{icon}</span>
      <span className="stroke text-2xl sm:text-3xl" style={{ color }}>
        {value}
      </span>
    </div>
  )
}

function Currencies() {
  const profile = useGameStore((s) => s.profile)
  return (
    <div className="absolute bottom-24 left-0 flex flex-col gap-1 sm:bottom-6">
      <Currency icon="🍬" value={formatNumber(profile.candy)} color="#ffb04d" />
      <Currency icon="🔄" value={formatNumber(profile.rebirths)} color="#c97dff" />
      <Currency icon="🏆" value={formatNumber(profile.wins)} color="#ffe14d" />
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Right: gifts, daily, event, worlds, perks, settings
 * ------------------------------------------------------------------------- */

function RightMenu() {
  const profile = useGameStore((s) => s.profile)
  const daily = useGameStore((s) => s.daily)
  const giftsAt = useGameStore((s) => s.giftsAt)
  const now = useNow()
  const claimed = profile.gifts.claimed || []
  const seconds = giftSeconds(profile, now, giftsAt)
  const next = GIFTS.find((g) => !claimed.includes(g.id))
  const readyCount = GIFTS.filter((g) => !claimed.includes(g.id) && seconds >= g.minutes * 60).length
  const giftLabel = !next ? 'Done!' : readyCount ? 'CLAIM!' : formatTime(next.minutes * 60 - seconds)

  return (
    <>
      <button type="button" onClick={() => openPanel('settings')} className="gbtn g-dark pointer-events-auto absolute right-2 top-2 h-11 w-11 text-2xl" aria-label="Settings">
        ⚙️
      </button>
      <div className="pointer-events-auto absolute right-2 top-[72px] flex flex-col items-end gap-2 sm:top-20">
        <PerkTile id="wins2x" label="2X WINS" rebirths={10} profile={profile} />
        <PerkTile id="power2x" label="2X POWER" rebirths={5} profile={profile} />
        <div className="flex gap-2">
          <SmallTile icon="🎃" label="Event" color="g-orange" onClick={() => openPanel('event')} />
          <SmallTile icon="🌍" label="Worlds" color="g-blue" onClick={() => openPanel('worlds')} />
        </div>
        <div className="flex gap-2">
          <SmallTile icon="📅" label="Daily" color="g-pink" onClick={() => openPanel('gifts')} badge={daily?.canClaim ? '!' : null} />
          <SmallTile icon="🎁" label={giftLabel} color="g-green" onClick={() => openPanel('gifts')} badge={readyCount ? readyCount : null} glow={readyCount > 0} />
        </div>
      </div>
    </>
  )
}

function SmallTile({ icon, label, color, onClick, badge, glow }) {
  return (
    <button type="button" onClick={onClick} className={`gbtn ${color} studs relative flex h-[62px] w-[62px] flex-col items-center justify-end sm:h-[72px] sm:w-[72px] ${glow ? 'anim-glow' : ''}`}>
      <span className="-mb-0.5 text-2xl sm:text-3xl">{icon}</span>
      <span className="stroke pb-0.5 text-xs sm:text-sm">{label}</span>
      {badge != null && <span className="stroke-sm absolute -right-2 -top-2 rounded-full border-2 border-black/70 bg-red-500 px-1.5 text-xs">{badge}</span>}
    </button>
  )
}

/** The original's paid 2X passes, here unlocked by rebirths. */
function PerkTile({ id, label, rebirths, profile }) {
  const owned = hasPerk(profile.rebirths, id)
  return (
    <button type="button" onClick={() => openPanel('rebirth')} className="gbtn g-rainbow studs flex h-12 w-40 flex-col items-center justify-center sm:h-14 sm:w-48">
      <span className="stroke text-lg leading-none sm:text-2xl">{label}</span>
      <span className="stroke-sm text-[11px] sm:text-xs">{owned ? '✅ ACTIVE' : `🔄 Rebirth ${rebirths}`}</span>
    </button>
  )
}

/* ---------------------------------------------------------------------------
 * Bottom: level bar, spinners, AUTO WIN, multiplier, potions
 * ------------------------------------------------------------------------- */

function BottomBar() {
  const profile = useGameStore((s) => s.profile)
  const now = useNow()
  const stats = computeStats(profile, now)
  const need = levelNeed(profile.level)
  const pct = Math.min(100, (profile.power / need) * 100)
  const nextSlot = nextSlotLevel(profile.level)
  const autoUnlocked = hasPerk(profile.rebirths, 'autoWin')
  const active = Object.entries(profile.activePotions || {}).filter(([, until]) => until > now)

  return (
    <>
      <div className="absolute bottom-2 left-1/2 w-[min(94vw,560px)] -translate-x-1/2">
        <div className="mb-1 flex items-end justify-between gap-2 px-1">
          <div className="stroke text-left text-sm leading-tight sm:text-lg">
            <div className="text-green-300">Next Spinner:</div>
            <div>{nextSlot ? `Level ${nextSlot}` : 'MAX'}</div>
          </div>
          <div className="stroke text-2xl text-yellow-300 sm:text-4xl">
            {stats.slots} SPINNER{stats.slots === 1 ? '' : 'S'}
          </div>
          <button
            type="button"
            className={`gbtn ${profile.autoWin ? 'g-green' : 'g-gray'} pointer-events-auto px-2 py-1 text-base sm:px-3 sm:text-xl stroke`}
            onClick={() => act(C2S.autoWin, { on: !profile.autoWin })}
            title={autoUnlocked ? 'Auto-battle through stages' : 'Unlocks at Rebirth 3'}
          >
            {autoUnlocked ? (profile.autoWin ? 'AUTO WIN ✓' : 'AUTO WIN') : '🔒 AUTO WIN'}
          </button>
        </div>
        <div className="relative h-10 overflow-hidden rounded-lg border-4 border-black/80 bg-[#22263a] sm:h-12">
          <div className="absolute inset-y-0 left-0 bg-linear-to-b from-lime-300 to-green-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
          <div className="relative flex h-full items-center justify-between px-3">
            <span className="stroke text-xl sm:text-3xl">LEVEL {profile.level}</span>
            <span className="stroke text-lg sm:text-2xl">
              {formatNumber(profile.power)}/{formatNumber(need)} Power
            </span>
          </div>
        </div>
        {active.length > 0 && (
          <div className="mt-1 flex justify-center gap-2">
            {active.map(([id, until]) => (
              <div key={id} className="g-dark stroke-sm flex items-center gap-1 rounded-lg border-2 border-black/70 px-2 text-sm">
                {POTIONS[id].icon} {POTIONS[id].name} {formatTime((until - now) / 1000)}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="stroke absolute bottom-2 right-3 text-3xl text-yellow-300 drop-shadow sm:text-4xl" title="Training power multiplier">
        x{formatNumber(stats.powerMult < 100 ? Math.round(stats.powerMult * 10) / 10 : stats.powerMult)}
      </div>
    </>
  )
}

/* ---------------------------------------------------------------------------
 * Overlays
 * ------------------------------------------------------------------------- */

function FadeOverlay() {
  const fading = useGameStore((s) => s.fading)
  return <div className={`absolute inset-0 z-40 bg-white transition-opacity duration-300 ${fading ? 'opacity-70' : 'pointer-events-none opacity-0'}`} />
}

function ConnectionBanner() {
  const status = useGameStore((s) => s.status)
  const profile = useGameStore((s) => s.profile)
  if (status === 'online' || !profile) return null
  return (
    <div className="stroke absolute left-1/2 top-24 z-40 -translate-x-1/2 rounded-xl border-4 border-black/70 bg-red-600/90 px-4 py-2 text-lg">
      {status === 'connecting' ? 'Connecting…' : 'Disconnected — reconnecting…'}
    </div>
  )
}

const PANELS = {
  spinners: SpinnersPanel,
  rebirth: RebirthPanel,
  trails: TrailsPanel,
  auras: AurasPanel,
  shop: ShopPanel,
  worlds: WorldsPanel,
  settings: SettingsPanel,
  gifts: GiftsPanel,
  event: EventPanel,
}

export default function Hud() {
  const profile = useGameStore((s) => s.profile)
  const battle = useGameStore((s) => s.battle)
  const panel = useGameStore((s) => s.panel)
  // Built once the loading screen lifts: painting all that outlined text underneath
  // an opaque overlay only slows the start down.
  const playable = useGameStore((s) => s.playable)
  const ActivePanel = PANELS[panel]

  // Esc closes panels.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') useGameStore.getState().closePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!playable) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {profile && !battle && (
        <>
          <QuestBar />
          <LeftMenu />
          <RightMenu />
          <BottomBar />
          <NearbyPrompt />
        </>
      )}
      {profile && <Currencies />}
      {battle && <BattleHud />}
      <Toasts />
      <Rewards />
      <LevelUpBanner />
      <CapsuleOpening />
      {profile && ActivePanel && <ActivePanel />}
      <ConnectionBanner />
      <FadeOverlay />
    </div>
  )
}
