import { useEffect, useMemo, useState } from 'react'

import {
  C2S,
  CAPSULE_LIST,
  GOLDEN,
  LIMITS,
  POTIONS,
  SPINNERS,
  computeStats,
  formatNumber,
  nextSlotLevel,
  spinnerScore,
  spinnerStats,
} from '@shared'

import { useGameStore } from '../../store/gameStore'
import { useNow } from '../../store/clock'
import { act, formatTime } from '../actions'
import { Panel, RarityText, SpinnerIcon } from '../common'
import { markTeamSeen } from '../teamTip'

/** "IN TEAM" tag on a spinner card. */
function TeamTag() {
  return (
    <span className="stroke-sm absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-black bg-green-500 px-2 text-[11px] leading-4">
      IN TEAM
    </span>
  )
}

function Cell({ item, equipped, selected, marked, onClick }) {
  const def = SPINNERS[item.id]
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex aspect-square items-center justify-center rounded-xl border-4 transition ${
        selected ? 'border-yellow-300 bg-white/30' : marked ? 'border-red-500 bg-red-500/30' : equipped ? 'border-green-400 bg-green-500/20' : 'border-black/60 bg-white/10 hover:bg-white/20'
      }`}
      title={def.name}
    >
      <SpinnerIcon id={item.id} golden={item.golden} size={60} />
      {equipped && <TeamTag />}
      {item.locked && <span className="absolute bottom-0 right-0 text-sm">🔒</span>}
    </button>
  )
}

/**
 * The team, at the top of the panel, explained for someone who has never played:
 * these spinners fight for you, more and stronger ones win harder stages, and levels
 * open more places in the team.
 */
function Team({ profile, stats, onPick }) {
  const byUid = new Map(profile.inventory.map((s) => [s.uid, s]))
  const team = profile.equipped.map((uid) => byUid.get(uid)).filter(Boolean)
  const next = nextSlotLevel(profile.level)
  let attack = 0
  let health = 0
  for (const s of team) {
    const st = spinnerStats(s.id, s.golden)
    attack += st.dmg * stats.dmgMult
    health += st.hp * stats.hpMult
  }
  const empty = Math.max(0, stats.slots - team.length)
  return (
    <div className="mb-3 rounded-xl border-4 border-black/60 bg-linear-to-b from-[#2a4bb8]/70 to-[#1d2140]/80 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="stroke text-2xl leading-tight">Your Team ({team.length}/{stats.slots})</div>
          <div className="stroke-sm text-sm">These spinners fight for you. Stronger and more spinners win harder stages!</div>
        </div>
        <div className="flex gap-2 text-lg">
          <span className="g-orange stroke rounded-lg border-2 border-black/60 px-2">⚔️ {formatNumber(attack)}</span>
          <span className="g-red stroke rounded-lg border-2 border-black/60 px-2">❤️ {formatNumber(health)}</span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {team.map((s) => (
          <button key={s.uid} type="button" onClick={() => onPick(s.uid)} className="relative flex h-20 w-20 items-center justify-center rounded-xl border-4 border-green-400 bg-white/15" title={SPINNERS[s.id].name}>
            <SpinnerIcon id={s.id} golden={s.golden} size={64} />
          </button>
        ))}
        {Array.from({ length: empty }, (_, i) => (
          <div key={`e${i}`} className="stroke-sm flex h-20 w-20 items-center justify-center rounded-xl border-4 border-dashed border-white/50 bg-black/20 p-1 text-center text-xs">
            Empty: tap a spinner below
          </div>
        ))}
        {next && (
          <div className="stroke-sm flex h-20 w-20 flex-col items-center justify-center rounded-xl border-4 border-black/50 bg-black/40 p-1 text-center text-xs leading-tight">
            <span className="text-2xl">🔒</span>
            Level {next}: +1 spinner
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className="gbtn g-green stroke px-5 py-1 text-xl" onClick={() => act(C2S.equipBest)}>
          ⭐ Equip Best
        </button>
        <span className="stroke-sm text-sm">Puts your strongest spinners in the team.</span>
      </div>
    </div>
  )
}

/** Where more spinners come from, in plain words. */
function Sources() {
  return (
    <div className="mt-3 rounded-xl border-4 border-black/60 bg-white/10 p-2">
      <div className="stroke mb-1 text-lg">How do I get more spinners?</div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="stroke-sm rounded-lg bg-black/25 p-2 text-sm">
          <div className="stroke text-base">💪 Level up</div>
          Train on a pad. Some levels give a free spinner and 1 more place in your team.
        </div>
        <div className="stroke-sm rounded-lg bg-black/25 p-2 text-sm">
          <div className="stroke text-base">🏆 Spinners Shop</div>
          Beat stages for Wins, then buy the spinner you want in the Spinners Shop.
          <button
            type="button"
            className="gbtn g-blue stroke mt-1 block w-full py-0.5 text-base"
            onClick={() => {
              act(C2S.teleport, { to: 'lobby', spot: 'shop' })
              useGameStore.getState().closePanel()
            }}
          >
            Go to the Spinners Shop ➜
          </button>
        </div>
        <div className="stroke-sm rounded-lg bg-black/25 p-2 text-sm">
          <div className="stroke text-base">✨ Golden</div>
          Have {GOLDEN.craftCount} of the same spinner? Combine them into a Golden one (x{GOLDEN.statMult} stronger).
        </div>
      </div>
    </div>
  )
}

function Details({ item, profile, stats }) {
  const def = SPINNERS[item.id]
  const base = spinnerStats(item.id, item.golden)
  const equipped = profile.equipped.includes(item.uid)
  const copies = profile.inventory.filter((s) => s.id === item.id && !s.golden).length
  return (
    <div className="relative flex flex-col items-center gap-1 rounded-xl border-4 border-black/60 bg-white/90 p-3 text-center">
      <SpinnerIcon id={item.id} golden={item.golden} size={104} />
      <div className="stroke text-2xl leading-tight">
        {item.golden && <span className="text-yellow-300">Golden </span>}
        {def.name}
      </div>
      <RarityText rarity={def.rarity} className="text-lg" />
      <div className="g-orange flex w-full items-center justify-between rounded-lg border-2 border-black/60 px-2 text-xl">
        <span>💥</span>
        <span className="stroke">{formatNumber(base.dmg * stats.dmgMult)}</span>
      </div>
      <div className="g-red flex w-full items-center justify-between rounded-lg border-2 border-black/60 px-2 text-xl">
        <span>❤️</span>
        <span className="stroke">{formatNumber(base.hp * stats.hpMult)}</span>
      </div>
      <div className="stroke-sm text-xs text-gray-700" style={{ textShadow: 'none' }}>
        Base ⚔️{formatNumber(base.dmg)} ❤️{formatNumber(base.hp)} • Level x{stats.levelMult.toFixed(2)}
      </div>
      <div className="mt-1 flex w-full gap-1">
        <button type="button" className={`gbtn ${equipped ? 'g-red' : 'g-green'} stroke flex-1 py-1 text-xl`} onClick={() => act(equipped ? C2S.unequip : C2S.equip, { uid: item.uid })}>
          {equipped ? 'Take out of team' : 'Put in team'}
        </button>
        <button type="button" className="gbtn g-gray px-2 text-xl" onClick={() => act(C2S.lockSpinner, { uid: item.uid })} title="Lock (protect from delete)">
          {item.locked ? '🔒' : '🔓'}
        </button>
        <button type="button" disabled={item.locked} className="gbtn g-yellow px-2 text-xl" onClick={() => act(C2S.deleteSpinners, { uids: [item.uid] })} title="Delete">
          🗑️
        </button>
      </div>
      {!item.golden && (
        <button
          type="button"
          disabled={copies < GOLDEN.craftCount}
          className="gbtn g-yellow stroke w-full py-1 text-lg"
          onClick={() => act(C2S.craftGolden, { id: item.id })}
          title={`Combine ${GOLDEN.craftCount} copies into a Golden one (x${GOLDEN.statMult} stats)`}
        >
          ✨ Craft Golden ({Math.min(copies, GOLDEN.craftCount)}/{GOLDEN.craftCount})
        </button>
      )}
    </div>
  )
}

function Index({ profile }) {
  const found = Object.keys(profile.index || {}).length
  const groups = [
    { name: 'Starter', ids: ['rookie'] },
    ...CAPSULE_LIST.map((c) => ({ name: c.name, ids: c.items.map((it) => it.spinner) })),
    { name: 'Shop', ids: ['crystal'] },
  ]
  return (
    <div>
      <div className="stroke mb-2 text-center text-xl">
        Discovered {found}/{Object.keys(SPINNERS).length}
      </div>
      {groups.map((g) => (
        <div key={g.name} className="mb-2">
          <div className="stroke-sm mb-1 text-lg">{g.name}</div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {g.ids.map((id) => {
              const has = profile.index?.[id]
              return (
                <div key={id} className="flex flex-col items-center rounded-lg border-2 border-black/50 bg-white/10 p-1" title={has ? SPINNERS[id].name : '???'}>
                  <div style={has ? undefined : { filter: 'brightness(0) opacity(0.6)' }}>
                    <SpinnerIcon id={id} size={52} />
                  </div>
                  <div className="stroke-sm w-full truncate text-center text-[11px]">{has ? SPINNERS[id].name : '???'}</div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function Items({ profile }) {
  const now = useNow()
  return (
    <div className="flex flex-col gap-2">
      {Object.values(POTIONS).map((p) => {
        const count = profile.potions?.[p.id] || 0
        const until = profile.activePotions?.[p.id] || 0
        return (
          <div key={p.id} className="flex items-center gap-3 rounded-xl border-4 border-black/60 bg-white/10 p-2">
            <span className="text-4xl">{p.icon}</span>
            <div className="flex-1">
              <div className="stroke text-xl">
                {p.name} <span className="text-yellow-300">x{count}</span>
              </div>
              <div className="stroke-sm text-sm">
                {p.desc} • {p.minutes} min
                {until > now && <span className="text-green-300"> • Active {formatTime((until - now) / 1000)}</span>}
              </div>
            </div>
            <button type="button" disabled={!count} className="gbtn g-green stroke px-4 py-1 text-xl" onClick={() => act(C2S.usePotion, { id: p.id })}>
              Use
            </button>
          </div>
        )
      })}
      <div className="stroke-sm text-center text-sm text-white/80">Potions come from gifts, quests and daily rewards.</div>
    </div>
  )
}

export default function SpinnersPanel() {
  const profile = useGameStore((s) => s.profile)
  const close = useGameStore((s) => s.closePanel)
  const [tab, setTab] = useState('spinners')
  const [selectedUid, setSelectedUid] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [marked, setMarked] = useState(() => new Set())
  const stats = computeStats(profile)

  const items = useMemo(
    () => [...profile.inventory].sort((a, b) => spinnerScore(b.id, b.golden) - spinnerScore(a.id, a.golden)),
    [profile.inventory],
  )
  const selected = items.find((s) => s.uid === selectedUid) || items[0]

  const toggleMark = (uid) => {
    const next = new Set(marked)
    if (next.has(uid)) next.delete(uid)
    else next.add(uid)
    setMarked(next)
  }

  // Opening this once is the "see your team" step for new players (see teamTip.js).
  useEffect(() => markTeamSeen(), [])

  const tabs = [
    ['spinners', '🌀 My Spinners'],
    ['index', '📖 Index'],
    ['items', '🧪 Items'],
  ]

  return (
    <Panel
      title="Spinners"
      icon="spinner"
      wide
      onClose={close}
    >
      <div className="mb-2 flex gap-2">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" className={`gbtn ${tab === id ? 'g-blue' : 'g-dark'} stroke px-3 py-1 text-lg`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'index' && <Index profile={profile} />}
      {tab === 'items' && <Items profile={profile} />}
      {tab === 'spinners' && (
        <>
          <Team profile={profile} stats={stats} onPick={setSelectedUid} />
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <div className="stroke-sm mb-1 text-sm">
                All your spinners ({profile.inventory.length}/{LIMITS.inventory}) • tap one to see it, then put it in your team
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {items.map((item) => (
                  <Cell
                    key={item.uid}
                    item={item}
                    equipped={profile.equipped.includes(item.uid)}
                    selected={!deleting && selected?.uid === item.uid}
                    marked={deleting && marked.has(item.uid)}
                    onClick={() => (deleting ? !item.locked && toggleMark(item.uid) : setSelectedUid(item.uid))}
                  />
                ))}
              </div>
            </div>
            {selected && !deleting && (
              <div className="w-full sm:w-56">
                <Details item={selected} profile={profile} stats={stats} />
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button type="button" className="gbtn g-red stroke px-4 py-1 text-xl" onClick={() => act(C2S.unequipAll)}>
              Empty Team
            </button>
            {deleting ? (
              <>
                <button
                  type="button"
                  disabled={!marked.size}
                  className="gbtn g-yellow stroke px-4 py-1 text-xl"
                  onClick={() => {
                    act(C2S.deleteSpinners, { uids: [...marked] })
                    setMarked(new Set())
                    setDeleting(false)
                  }}
                >
                  🗑️ Delete {marked.size}
                </button>
                <button type="button" className="gbtn g-gray stroke px-3 py-1 text-xl" onClick={() => setDeleting(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" className="gbtn g-gray stroke px-3 py-1 text-xl" onClick={() => setDeleting(true)}>
                🗑️ Multi-delete
              </button>
            )}
          </div>
          <Sources />
        </>
      )}
    </Panel>
  )
}
