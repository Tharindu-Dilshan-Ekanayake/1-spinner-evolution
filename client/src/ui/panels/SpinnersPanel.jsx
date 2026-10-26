import { useMemo, useState } from 'react'

import {
  C2S,
  CAPSULE_LIST,
  GOLDEN,
  LIMITS,
  POTIONS,
  SPINNERS,
  computeStats,
  formatNumber,
  spinnerScore,
  spinnerStats,
} from '@shared'

import { useGameStore } from '../../store/gameStore'
import { useNow } from '../../store/clock'
import { act, formatTime } from '../actions'
import { Panel, RarityText, SpinnerIcon } from '../common'

function Cell({ item, equipped, selected, marked, onClick }) {
  const def = SPINNERS[item.id]
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex aspect-square items-center justify-center rounded-xl border-4 transition ${
        selected ? 'border-yellow-300 bg-white/30' : marked ? 'border-red-500 bg-red-500/30' : 'border-black/60 bg-white/10 hover:bg-white/20'
      }`}
      title={def.name}
    >
      <SpinnerIcon id={item.id} golden={item.golden} size={60} />
      {equipped && <span className="absolute -left-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-black bg-white text-lg text-black">✔</span>}
      {item.locked && <span className="absolute bottom-0 right-0 text-sm">🔒</span>}
    </button>
  )
}

function Details({ item, profile, stats }) {
  const def = SPINNERS[item.id]
  const base = spinnerStats(item.id, item.golden)
  const equipped = profile.equipped.includes(item.uid)
  const copies = profile.inventory.filter((s) => s.id === item.id && !s.golden).length
  return (
    <div className="studs relative flex flex-col items-center gap-1 rounded-xl border-4 border-black/60 bg-white/90 p-3 text-center">
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
          {equipped ? 'Unequip' : 'Equip'}
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
    ...CAPSULE_LIST.map((c) => ({ name: c.name, ids: c.drops.map((d) => d.spinner) })),
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
      <div className="stroke-sm text-center text-sm text-white/80">Potions come from gifts, quests, daily rewards and pumpkins.</div>
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

  const tabs = [
    ['spinners', '🌀 Spinners'],
    ['index', '📖 Index'],
    ['items', '🧪 Items'],
  ]

  return (
    <Panel
      title="Spinners"
      icon="🌀"
      color="g-yellow"
      wide
      onClose={close}
      extra={<span className="stroke hidden text-xl sm:block">{profile.equipped.length}/{stats.slots} Equipped</span>}
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
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <div className="stroke-sm mb-1 text-sm">
                {profile.inventory.length}/{LIMITS.inventory} spinners • {profile.equipped.length}/{stats.slots} equipped
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
            <button type="button" className="gbtn g-blue stroke px-4 py-1 text-xl" onClick={() => act(C2S.equipBest)}>
              Equip Best
            </button>
            <button type="button" className="gbtn g-red stroke px-4 py-1 text-xl" onClick={() => act(C2S.unequipAll)}>
              Unequip All
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
        </>
      )}
    </Panel>
  )
}
