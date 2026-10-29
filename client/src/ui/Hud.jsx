import { useEffect, useState } from 'react'

import {
  GIFTS,
  computeStats,
  formatNumber,
  hasPerk,
  levelNeed,
  nextSlotLevel,
  rebirthLevelReq,
  spinnerScore,
  zoneOfWorld,
} from '@shared'

import { isMuted, toggleMute } from '../audio/audio'
import { sfx } from '../audio/sfx'
import { useBloxity } from '../bloxity/BloxityContext'
import { inTutorial } from '../game/guide'
import { spinnerIcon } from '../game/spinners/iconRenderer'
import { useNow } from '../store/clock'
import { useGameStore } from '../store/gameStore'
import BattleHud from './BattleHud'
import CapsuleOpening from './CapsuleOpening'
import { formatTime, giftSeconds } from './actions'
import Icon from './kit/Icon'
import { useHudMode } from './kit/layout'
import { AlertBadge, Price, RoundButton } from './kit/parts'
import StrokeText from './kit/StrokeText'
import { GRADIENTS, u } from './kit/style'
import NearbyPrompt from './NearbyPrompt'
import AurasPanel from './panels/AurasPanel'
import GiftsPanel from './panels/GiftsPanel'
import RebirthPanel from './panels/RebirthPanel'
import SettingsPanel from './panels/SettingsPanel'
import ShopPanel from './panels/ShopPanel'
import SpinnersPanel from './panels/SpinnersPanel'
import TrailsPanel from './panels/TrailsPanel'
import WorldsPanel from './panels/WorldsPanel'
import { LevelUpBanner, Rewards, Toasts, WinsFlight } from './Notifications'
import TeamSlots from './TeamSlots'
import { useTeamTip } from './teamTip'

/*
 * The heads-up display, laid out like the studio's +1 Slide Downhill, in three
 * arrangements (see kit/layout.js) so it fits any screen:
 *
 *   wide  - Wins / Rebirths down the left under the logo corner, the menu tiles
 *           below them, the FREE GIFT and the 2X passes down the right, the run
 *           top-centre
 *   short - (phone landscape) the same, with a tighter left column
 *   tall  - (portrait) the same, with the gift timer below the top-right buttons
 *
 * The top-left corner is always left clear: the platform puts its logos there. The
 * buttons follow the studio's newest game, +1 Muscle to Push Boulder: purple menu
 * tiles (red for the shop and rebirth), and big sticker icons on rainbow rays for the
 * gift and the passes.
 */

function openPanel(name) {
  sfx.open()
  useGameStore.getState().setPanel(name)
}

/** Every position and size that changes between the three arrangements (reference px). */
const LAYOUT = {
  wide: {
    stats: { left: 20, top: 150, row: false, size: 1 },
    menu: { left: 18, top: 404, cols: 2, tile: 112 },
    right: { right: 20, top: 96, scale: 0.8 },
    topCenter: { top: 24 },
    nameTag: true,
  },
  short: {
    stats: { left: 18, top: 118, row: false, size: 0.85 },
    menu: { left: 16, top: 326, cols: 2, tile: 94 },
    right: { right: 24, top: 88, scale: 0.68 },
    topCenter: { top: 24 },
    nameTag: true,
  },
  tall: {
    stats: { left: 20, top: 150, row: false, size: 0.9 },
    menu: { left: 18, top: 410, cols: 2, tile: 104 },
    right: { right: 14, top: 118, scale: 0.62 },
    topCenter: { top: 90 },
    nameTag: true,
  },
}

/* ---------------------------------------------------------------------------
 * Stats: Wins, Rebirths
 * ------------------------------------------------------------------------- */

function StatRow({ icon, value, gradient, size, counter }) {
  return (
    <div className="relative flex items-center" style={{ height: u(74 * size) }} {...(counter ? { 'data-wins-counter': true } : {})}>
      <Icon name={icon} size={u(72 * size)} />
      <span style={{ fontSize: u(54 * size), marginLeft: u(8) }}>
        <StrokeText stroke={u(11 * size)} gradient={gradient}>
          {value}
        </StrokeText>
      </span>
    </div>
  )
}

/** Wins and Rebirths. */
function StatsPanel({ layout }) {
  // Counts up as the flying trophies land (see WinsFlight).
  const wins = useGameStore((s) => Math.max(0, s.profile.wins - s.winsInFlight))
  const rebirths = useGameStore((s) => s.profile.rebirths)
  const { left, top, row, size } = layout.stats
  return (
    <div className={`pointer-events-none absolute flex ${row ? 'flex-row' : 'flex-col'}`} style={{ left: u(left), top: u(top), gap: row ? u(26) : u(4) }}>
      <StatRow icon="trophy" value={formatNumber(wins)} gradient={GRADIENTS.gold} size={size} counter />
      <StatRow icon="rebirth" value={formatNumber(rebirths)} size={size} />
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Menu tiles
 * ------------------------------------------------------------------------- */

function MenuTile({ icon, image, label, accent, onClick, alert, top, size }) {
  const k = size / 112
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => onClick?.()}
      className="pp-tile pointer-events-auto relative flex flex-col items-center justify-center"
      style={{ width: u(size), height: u(size), '--accent': accent }}
    >
      {image ? (
        <img src={image} alt="" draggable={false} className="pointer-events-none select-none" style={{ width: u(66 * k), height: u(66 * k), marginTop: u(-8 * k), filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.45))' }} />
      ) : (
        <Icon name={icon} size={u(66 * k)} style={{ marginTop: u(-8 * k), filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.45))' }} />
      )}
      <span className="pp-tile-label" style={{ fontSize: u(24 * k), marginTop: u(2 * k) }}>
        {label}
      </span>
      {top && (
        <span className="pp-tile-pill" style={{ top: u(-9 * k), right: u(-9 * k), fontSize: u(20 * k) }}>
          {top}
        </span>
      )}
      {alert && <AlertBadge size={32 * k} style={{ top: u(-10 * k), right: u(-10 * k) }} />}
    </button>
  )
}

/** The player's first equipped spinner, rendered by the game itself (null until ready). */
function useSpinnerPicture() {
  const lead = useGameStore((s) => {
    const p = s.profile
    const item = p.inventory.find((it) => it.uid === p.equipped[0])
    return item ? `${item.id}|${item.golden ? 1 : 0}` : 'rookie|0'
  })
  // Re-render when the renderer finishes a picture.
  useGameStore((s) => s.iconVersion)
  const [id, golden] = lead.split('|')
  return spinnerIcon(id, golden === '1')
}

/** True when a spinner you own would make the team stronger (an empty place, or a better spare). */
function useTeamCanImprove() {
  return useGameStore((s) => {
    const p = s.profile
    const spare = p.inventory.filter((it) => !p.equipped.includes(it.uid))
    if (!spare.length) return false
    if (p.equipped.length < computeStats(p).slots) return true
    const score = (it) => spinnerScore(it.id, it.golden)
    const weakest = Math.min(...p.inventory.filter((it) => p.equipped.includes(it.uid)).map(score))
    return spare.some((it) => score(it) > weakest)
  })
}

/** Bouncing "See your team!" pointing at the Spinners tile, until it has been opened once. */
function TeamTip({ size }) {
  return (
    <span className="anim-bob pointer-events-none absolute flex items-center whitespace-nowrap" style={{ left: `calc(100% + ${u(14)})`, top: '50%', marginTop: u(-24), fontSize: u(30 * (size / 112)) }}>
      <StrokeText stroke={u(7)} fill="#ffe36b">
        ◀ See your team!
      </StrokeText>
    </span>
  )
}

function LeftMenu({ layout }) {
  const spinnerPicture = useSpinnerPicture()
  const improve = useTeamCanImprove()
  // After the first-time tutorial (first capsule opened), point at the team once.
  const tutorialDone = useGameStore((s) => s.profile.tutorialDone !== false)
  const seen = useTeamTip((t) => t.seen)
  const showTip = tutorialDone && !seen
  const rebirths = useGameStore((s) => s.profile.rebirths)
  const level = useGameStore((s) => s.profile.level)
  const pct = Math.min(100, Math.floor((level / rebirthLevelReq(rebirths)) * 100))
  const { left, top, cols, tile } = layout.menu
  return (
    <div className="pointer-events-none absolute grid" style={{ left: u(left), top: u(top), gridTemplateColumns: `repeat(${cols}, auto)`, gap: u(14) }}>
      {/* Four buttons: the Shop holds capsules, auras and trails; Spinners is your team. */}
      <MenuTile icon="shop" label="Shop" accent="#ff5a6e" size={tile} onClick={() => openPanel('shop')} />
      <div className="relative">
        <MenuTile icon="spinner" image={spinnerPicture} label="Spinners" accent="#ffb02e" size={tile} alert={improve} onClick={() => openPanel('spinners')} />
        {showTip && <TeamTip size={tile} />}
      </div>
      <MenuTile icon="rebirth" label="Rebirth" accent="#c77dff" size={tile} top={pct < 100 ? `${pct}%` : null} alert={pct >= 100} onClick={() => openPanel('rebirth')} />
      <MenuTile icon="portalSwirl" label="Worlds" accent="#3fc1ff" size={tile} onClick={() => openPanel('worlds')} />
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Right: the FREE GIFT and the 2X passes (earned with rebirths here), each a big sticker
 * icon on slowly turning rainbow rays (as in Muscle to Push Boulder)
 * ------------------------------------------------------------------------- */

/** Rainbow rays turning slowly behind a sticker icon. */
const RAYS = 'repeating-conic-gradient(from 0deg, #ff3b5c 0deg 10deg, #ffe53b 10deg 20deg, #4ef05a 20deg 30deg, #2fc6ff 30deg 40deg, #b45cff 40deg 50deg, transparent 50deg 60deg)'
const RAY_MASK = 'radial-gradient(circle, #000 30%, transparent 70%)'

function StickerIcon({ icon, rays }) {
  return (
    <span className="relative flex items-center justify-center" style={{ width: u(170), height: u(150) }}>
      {rays && <span className="pp-spin absolute rounded-full" style={{ width: u(170), height: u(170), background: RAYS, opacity: 0.75, maskImage: RAY_MASK, WebkitMaskImage: RAY_MASK }} />}
      <Icon name={icon} size={u(150)} className="relative" />
    </span>
  )
}

/** The next playtime gift: counts down, then bounces until it's claimed. */
function GiftTimer() {
  const profile = useGameStore((s) => s.profile)
  const giftsAt = useGameStore((s) => s.giftsAt)
  const now = useNow()
  const claimed = profile.gifts.claimed || []
  const seconds = giftSeconds(profile, now, giftsAt)
  const next = GIFTS.find((g) => !claimed.includes(g.id))
  if (!next) return null
  const ready = GIFTS.filter((g) => !claimed.includes(g.id) && seconds >= g.minutes * 60).length
  return (
    <button type="button" onClick={() => openPanel('gifts')} title="Free Gifts" className={`pp-btn pointer-events-auto relative flex flex-col items-center ${ready ? 'pp-bounce' : ''}`} style={{ width: u(230) }}>
      <StickerIcon icon="gift" rays={ready > 0} />
      <span style={{ fontSize: u(46), marginTop: u(-18), transform: 'rotate(-4deg)' }}>
        <StrokeText stroke={u(10)}>{ready ? 'CLAIM!' : 'FREE GIFT'}</StrokeText>
      </span>
      <span style={{ fontSize: u(30) }}>
        <StrokeText stroke={u(7)} gradient={GRADIENTS.gold}>
          {ready ? `${ready} ready` : formatTime(next.minutes * 60 - seconds)}
        </StrokeText>
      </span>
    </button>
  )
}

/** x2 Wins only shows where there's room for it (landscape phones skip it). */
const PASSES = [
  { id: 'power2x', label: 'X2 POWER', icon: 'muscle', rebirths: 5 },
  { id: 'wins2x', label: 'X2 WINS', icon: 'trophy', rebirths: 10, className: 'pp-tall-only' },
]

function PassButton({ id, label, icon, rebirths, className = '' }) {
  const owned = useGameStore((s) => hasPerk(s.profile.rebirths, id))
  return (
    <button type="button" onClick={() => openPanel('rebirth')} title={label} className={`pp-btn pointer-events-auto relative flex flex-col items-center ${className}`} style={{ width: u(230) }}>
      <StickerIcon icon={icon} rays={!owned} />
      <span style={{ fontSize: u(46), marginTop: u(-30), transform: 'rotate(8deg)' }}>
        <StrokeText stroke={u(10)} gradient={GRADIENTS.rainbow}>
          {label}
        </StrokeText>
      </span>
      <span className="flex items-center" style={{ transform: 'rotate(8deg)', gap: u(6), marginTop: u(-2), fontSize: u(34) }}>
        {owned ? (
          <StrokeText stroke={u(8)} fill="#7dff4a">
            ACTIVE
          </StrokeText>
        ) : (
          <>
            <Icon name="rebirth" size={u(38)} />
            <StrokeText stroke={u(8)} gradient={GRADIENTS.purpleText}>
              Rebirth {rebirths}
            </StrokeText>
          </>
        )}
      </span>
    </button>
  )
}

/** Down the right-hand side, under the round buttons; first-time players only see the gift. */
function RightColumn({ layout, simple }) {
  const { right, top, scale } = layout.right
  return (
    <div className="pointer-events-none absolute flex flex-col items-center" style={{ right: u(right), top: u(top), gap: u(18), transform: `scale(${scale})`, transformOrigin: 'top right' }}>
      <GiftTimer />
      {!simple && PASSES.map((p) => <PassButton key={p.id} {...p} />)}
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Top-right: sound, daily, settings, name tag
 * ------------------------------------------------------------------------- */

function SoundButton() {
  const [muted, setMuted] = useState(isMuted)
  return <RoundButton icon={muted ? 'soundOff' : 'sound'} label={muted ? 'Sound: off' : 'Sound: on'} onClick={() => setMuted(toggleMute())} iconSize={36} />
}

function NameTag() {
  const { identity } = useBloxity()
  const name = identity?.displayName || identity?.username || 'Guest'
  const pfp = identity?.pfp
  return (
    <div
      className="pointer-events-none flex items-center"
      style={{
        height: u(64),
        padding: `0 ${u(18)} 0 ${u(6)}`,
        gap: u(10),
        borderRadius: u(32),
        background: 'linear-gradient(180deg, rgba(58, 68, 98, 0.94), rgba(26, 30, 46, 0.94))',
        border: `${u(4)} solid #111`,
        boxShadow: `0 ${u(6)} 0 #111, inset 0 ${u(3)} 0 rgba(255,255,255,0.18)`,
      }}
    >
      {pfp ? (
        <img src={pfp} alt="" className="rounded-full object-cover" style={{ width: u(46), height: u(46), border: `${u(3)} solid #fff`, background: '#2c344d' }} />
      ) : (
        <div className="flex items-center justify-center rounded-full" style={{ width: u(46), height: u(46), border: `${u(3)} solid #fff`, background: GRADIENTS.blueButton, fontSize: u(26) }}>
          <StrokeText stroke={u(5)}>{name.charAt(0).toUpperCase()}</StrokeText>
        </div>
      )}
      <span className="max-w-[22vw] truncate" style={{ fontSize: u(28) }}>
        <StrokeText stroke={u(6)}>{name}</StrokeText>
      </span>
    </div>
  )
}

function TopRight({ layout }) {
  const daily = useGameStore((s) => s.daily)
  return (
    <div className="pointer-events-none absolute flex items-center" style={{ right: u(14), top: u(12), gap: u(12) }}>
      <SoundButton />
      <RoundButton icon="calendar" label="Daily Rewards" alert={Boolean(daily?.canClaim)} onClick={() => openPanel('gifts')} iconSize={42} />
      <RoundButton icon="gear" label="Settings" onClick={() => openPanel('settings')} iconSize={42} />
      {layout.nameTag && <NameTag />}
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Top-centre: the stage run while one is going (kept small: the middle of the
 * screen belongs to the game)
 * ------------------------------------------------------------------------- */

/** The stage run in progress: how far you've got, what it's worth, how to bank it. */
function RunCard() {
  const run = useGameStore((s) => s.run)
  const zone = useGameStore((s) => s.zone)
  // Back in the lobby hub the banner goes (the run and its wins are kept: walk back to the
  // stages, or to the yellow Return pad, to bank them).
  const onStages = useGameStore((s) => s.nearby.onStages)
  if (!run || run.cleared <= 0 || zone !== zoneOfWorld(run.world) || !onStages) return null
  return (
    <div className="pp-glass anim-fade flex items-center" style={{ '--accent': '#4be37a', gap: u(16), padding: `${u(12)} ${u(26)} ${u(12)} ${u(14)}`, borderRadius: u(26) }}>
      <span className="flex shrink-0 items-center justify-center rounded-full" style={{ width: u(58), height: u(58), background: 'linear-gradient(180deg, #5bea84, #1fa84d)', boxShadow: `inset 0 ${u(2)} 0 rgba(255,255,255,0.35), 0 ${u(3)} ${u(8)} rgba(0,0,0,0.35)` }}>
        <Icon name="check" size={u(34)} />
      </span>
      <div className="flex flex-col" style={{ gap: u(2) }}>
        <span className="pp-glass-title" style={{ fontSize: u(32) }}>
          Stage {run.cleared} cleared!
        </span>
        <span className="pp-glass-sub" style={{ fontSize: u(22) }}>
          Walk to the yellow Return pad to bank your wins
        </span>
      </div>
      {run.wins > 0 && (
        <div className="flex items-center" style={{ gap: u(14), paddingLeft: u(16), borderLeft: `${u(2)} solid rgba(255,255,255,0.14)` }}>
          <Price amount={run.wins} size={32} />
        </div>
      )}
    </div>
  )
}

function TopCenter({ layout }) {
  return (
    <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ top: u(layout.topCenter.top), gap: u(20) }}>
      <RunCard />
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Bottom-centre: running potions, spinner count, level bar and the team's slots
 * ------------------------------------------------------------------------- */

const POTION_ICONS = { power: 'potionPower', wins: 'potionWins', lucky: 'potionLucky' }

function LevelBar({ level, power, need }) {
  const fill = Math.min(1, power / need)
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        height: u(78),
        borderRadius: u(40),
        border: `${u(6)} solid #0b2a6b`,
        background: '#eef6ff',
        boxShadow: `0 ${u(5)} 0 #0b2a6b, inset 0 ${u(-6)} 0 rgba(0,0,0,0.08)`,
      }}
    >
      <div className="absolute inset-y-0 left-0 transition-[width] duration-300 ease-out" style={{ width: `${fill * 100}%`, background: GRADIENTS.levelFill, borderRadius: u(34) }} />
      <div className="absolute" style={{ left: u(18), right: u(18), top: u(6), height: u(14), borderRadius: u(8), background: 'rgba(255,255,255,0.35)' }} />
      <div className="absolute inset-0 flex items-center justify-between" style={{ padding: `0 ${u(30)}`, fontSize: u(46) }}>
        <StrokeText stroke={u(10)}>Level {level}</StrokeText>
        <StrokeText stroke={u(10)}>
          {formatNumber(power)}/{formatNumber(need)} Power
        </StrokeText>
      </div>
    </div>
  )
}

function BottomBar() {
  const profile = useGameStore((s) => s.profile)
  const now = useNow()
  const stats = computeStats(profile, now)
  const need = levelNeed(profile.level)
  const nextSlot = nextSlotLevel(profile.level)
  const active = Object.entries(profile.activePotions || {}).filter(([, until]) => until > now)
  const mult = stats.powerMult < 100 ? Math.round(stats.powerMult * 10) / 10 : stats.powerMult

  return (
    <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ bottom: u(14), width: `min(${u(900)}, 94vw)`, gap: u(8) }}>
      {active.length > 0 && (
        <div className="flex w-full items-center justify-center" style={{ gap: u(18) }}>
          {active.map(([id, until]) => (
            <div key={id} className="flex items-center" style={{ fontSize: u(28) }}>
              <Icon name={POTION_ICONS[id] || 'potionWins'} size={u(54)} />
              <StrokeText stroke={u(6)}>{formatTime((until - now) / 1000)}</StrokeText>
            </div>
          ))}
        </div>
      )}
      <div className="relative flex w-full items-end justify-center" style={{ height: u(52) }}>
        {nextSlot && (
          <span className="absolute flex flex-col leading-none" style={{ left: u(30), bottom: 0, fontSize: u(26), gap: u(2) }}>
            <StrokeText stroke={u(6)} fill="#9dff6a">
              +1 Spinner at
            </StrokeText>
            <StrokeText stroke={u(6)}>Level {nextSlot}</StrokeText>
          </span>
        )}
        <span style={{ fontSize: u(46) }}>
          <StrokeText stroke={u(10)} gradient={GRADIENTS.gold}>
            {stats.slots} SPINNER{stats.slots === 1 ? '' : 'S'}
          </StrokeText>
        </span>
        {mult > 1 && (
          <span className="absolute" style={{ right: u(30), bottom: u(-2), fontSize: u(34) }}>
            <StrokeText stroke={u(7)} gradient={GRADIENTS.purpleText}>
              Power x{formatNumber(mult)}
            </StrokeText>
          </span>
        )}
      </div>
      <LevelBar level={profile.level} power={profile.power} need={need} />
      {/* The team's slots (locked ones say what opens them); click one to fill it. */}
      <div className="flex w-full justify-center" style={{ marginTop: u(6) }}>
        <TeamSlots />
      </div>
    </div>
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
    <div className="absolute left-1/2 z-40 -translate-x-1/2 rounded-2xl border-4 border-[#111] px-5 py-2" style={{ top: u(200), background: GRADIENTS.redButton, fontSize: u(36) }}>
      <StrokeText stroke={u(8)}>{status === 'connecting' ? 'Connecting…' : 'Disconnected — reconnecting…'}</StrokeText>
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
}

export default function Hud() {
  const profile = useGameStore((s) => s.profile)
  const battle = useGameStore((s) => s.battle)
  const panel = useGameStore((s) => s.panel)
  // Built once the loading screen lifts: painting all that outlined text underneath
  // an opaque overlay only slows the start down.
  const playable = useGameStore((s) => s.playable)
  const mode = useHudMode()
  const layout = LAYOUT[mode]
  const ActivePanel = PANELS[panel]
  // First-time players get a quieter HUD: the rebirth passes, the event and AUTO WIN
  // appear once the tutorial (train, win, open a capsule) is done.
  const simple = useGameStore((s) => inTutorial(s.profile))

  // Esc closes panels.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') useGameStore.getState().closePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // The HUD (about twenty SVG icons and a lot of outlined text) mounts one idle moment
  // after the world is playable, so building it never stalls the first frames.
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!playable || shown) return undefined
    const show = () => setShown(true)
    if (window.requestIdleCallback) {
      const id = window.requestIdleCallback(show, { timeout: 700 })
      return () => window.cancelIdleCallback(id)
    }
    const id = setTimeout(show, 200)
    return () => clearTimeout(id)
  }, [playable, shown])

  if (!shown) return null

  return (
    <div className="pp-font anim-fade pointer-events-none absolute inset-0 z-20 select-none">
      {profile && !battle && (
        // While a panel is open the HUD steps aside, as in the slide game.
        <div className="absolute inset-0 transition-opacity duration-150" style={{ opacity: ActivePanel ? 0 : 1, visibility: ActivePanel ? 'hidden' : 'visible' }}>
          <StatsPanel layout={layout} />
          <LeftMenu layout={layout} />
          <RightColumn layout={layout} simple={simple} />
          <TopRight layout={layout} />
          <TopCenter layout={layout} />
          <BottomBar />
          <NearbyPrompt />
        </div>
      )}
      {battle && <BattleHud />}
      <Toasts />
      <Rewards />
      <WinsFlight />
      <LevelUpBanner />
      <CapsuleOpening />
      {profile && ActivePanel && <ActivePanel />}
      <ConnectionBanner />
      <FadeOverlay />
    </div>
  )
}
