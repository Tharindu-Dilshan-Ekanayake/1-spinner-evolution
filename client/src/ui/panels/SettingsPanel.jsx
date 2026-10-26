import { useState } from 'react'

import { formatNumber } from '@shared'

import { audioSettings, setVolume } from '../../audio/audio'
import { useBloxity } from '../../bloxity/BloxityContext'
import { useGameStore } from '../../store/gameStore'
import { useQualityStore } from '../../store/qualityStore'
import { formatTime } from '../actions'
import { Panel } from '../common'

function Slider({ label, value, onChange }) {
  return (
    <label className="flex items-center gap-3">
      <span className="stroke w-24 text-lg">{label}</span>
      <input type="range" min="0" max="1" step="0.05" value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-yellow-400" />
      <span className="stroke w-12 text-right">{Math.round(value * 100)}%</span>
    </label>
  )
}

export default function SettingsPanel() {
  const close = useGameStore((s) => s.closePanel)
  const profile = useGameStore((s) => s.profile)
  const { preset, auto, choose, enableAuto } = useQualityStore()
  const { identity, isLoggedIn, login, logout, status } = useBloxity()
  const [volumes, setVolumes] = useState({ ...audioSettings })

  const setVol = (kind, v) => {
    setVolume(kind, v)
    setVolumes((s) => ({ ...s, [kind]: v }))
  }

  const name = identity?.displayName || identity?.username || 'Guest'
  const st = profile.stats || {}

  return (
    <Panel title="Settings" icon="⚙️" color="g-gray" onClose={close}>
      <div className="stroke mb-1 text-xl">Graphics</div>
      <div className="grid grid-cols-4 gap-2">
        <button type="button" className={`gbtn ${auto ? 'g-green' : 'g-dark'} stroke py-1 text-lg`} onClick={enableAuto}>
          Auto
        </button>
        {['LOW', 'MEDIUM', 'HIGH'].map((p) => (
          <button key={p} type="button" className={`gbtn ${!auto && preset === p ? 'g-green' : 'g-dark'} stroke py-1 text-lg`} onClick={() => choose(p)}>
            {p === 'MEDIUM' ? 'MED' : p}
          </button>
        ))}
      </div>
      <div className="stroke-sm mt-1 text-sm text-white/80">
        Now: {preset}
        {auto && ' (auto — drops if FPS falls below 45)'}
      </div>

      <div className="stroke mb-1 mt-4 text-xl">Sound</div>
      <div className="flex flex-col gap-2">
        <Slider label="Music" value={volumes.music} onChange={(v) => setVol('music', v)} />
        <Slider label="Effects" value={volumes.sfx} onChange={(v) => setVol('sfx', v)} />
      </div>

      <div className="stroke mb-1 mt-4 text-xl">Account</div>
      <div className="flex items-center gap-3 rounded-xl border-4 border-black/60 bg-white/10 p-2">
        {identity?.pfp ? (
          <img src={identity.pfp} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-xl">{name.charAt(0).toUpperCase()}</div>
        )}
        <div className="flex-1">
          <div className="stroke text-lg">{name}</div>
          <div className="stroke-sm text-xs">{isLoggedIn ? 'Signed in with Bloxity — progress saved to your account' : 'Playing as guest — progress saved on this device'}</div>
        </div>
        {isLoggedIn ? (
          <button type="button" className="gbtn g-gray stroke px-3 py-1" onClick={logout}>
            Log out
          </button>
        ) : (
          <button type="button" disabled={status !== 'ready'} className="gbtn g-purple stroke px-3 py-1" onClick={login}>
            {status === 'ready' ? 'Log in' : '…'}
          </button>
        )}
      </div>

      <div className="stroke mb-1 mt-4 text-xl">Your stats</div>
      <div className="stroke-sm grid grid-cols-2 gap-1 text-base">
        <div>⏱️ Playtime: {formatTime(st.playtime || 0)}</div>
        <div>🏆 Wins earned: {formatNumber(st.totalWins || 0)}</div>
        <div>⚔️ Battles won: {formatNumber(st.battlesWon || 0)}</div>
        <div>💀 Battles lost: {formatNumber(st.battlesLost || 0)}</div>
        <div>🎁 Capsules: {formatNumber(st.capsules || 0)}</div>
        <div>✨ Golden crafted: {formatNumber(st.golden || 0)}</div>
      </div>

      <div className="stroke-sm mt-4 text-xs text-white/70">
        Controls: WASD / arrows to move • Space to jump • Shift to sprint • drag to look • scroll to zoom • click to train &amp; boost.
      </div>
    </Panel>
  )
}
