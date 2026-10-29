import { useEffect, useMemo, useRef, useState } from 'react'

import { ANIM } from '@shared'

import { useGameStore } from '../store/gameStore'
import { live } from '../store/live'
import { quality, useQuality } from '../store/qualityStore'
import { ORDER, useSystem } from './loop'
import { bubbleFor } from '../bloxity/chatBubbles'
import { overlay } from './overlay/worldOverlay'
import { turnAwareSpeed } from './avatarRig'
import PlayerAvatar from './PlayerAvatar'

const NAME_HEIGHT = 2.55
const REFRESH_MS = 700

/** Smoothly chase the latest server position of every remote player in our zone. */
function useRemoteInterpolation() {
  useSystem(ORDER.remotes, (dt, state) => {
    const k = 1 - Math.pow(0.0001, dt)
    const maxD = quality().viewDistance
    const p = live.player
    const list = live.remoteList
    for (let i = 0; i < list.length; i += 1) {
      const r = list[i]
      if (r.zone !== live.zone) continue
      const ox = r.x
      const oz = r.z
      r.x += (r.tx - r.x) * k
      r.y += (r.ty - r.y) * k
      r.z += (r.tz - r.z) * k
      let d = r.try - r.ry
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      r.ry += d * k
      r.speed = dt > 0 ? Math.hypot(r.x - ox, r.z - oz) / dt : 0

      const dx = r.x - p.x
      const dz = r.z - p.z
      if (dx * dx + dz * dz < maxD * maxD * 0.25) {
        overlay.name(state.camera, r.x, r.y + NAME_HEIGHT, r.z, r.name, r.sub)
        // Their latest Boxity chat line, just above the name tag.
        const line = bubbleFor(r.uid)
        if (line) overlay.bubble(state.camera, r.x, r.y + NAME_HEIGHT + 0.9, r.z, line)
      }
    }
  })
}

function RemotePlayer({ id }) {
  const groupRef = useRef(null)
  const visualRef = useRef(null)
  const motionRef = useRef({ time: 0, speed: 0, grounded: true, maxSpeed: 9 })
  const avatarJson = live.remotes.get(id)?.avatar || ''

  const remote = useMemo(() => {
    try {
      const parsed = JSON.parse(avatarJson || '{}')
      return { equipped: parsed.equipped || null, proportions: parsed.proportions || null }
    } catch {
      return { equipped: null, proportions: null }
    }
  }, [avatarJson])

  useSystem(ORDER.remotes + 1, (dt) => {
    const r = live.remotes.get(id)
    const g = groupRef.current
    if (!r || !g) return
    g.position.set(r.x, r.y, r.z)
    if (visualRef.current) visualRef.current.rotation.y = r.ry
    const m = motionRef.current
    m.time += dt
    m.speed = turnAwareSpeed(m, r.ry, r.speed, m.maxSpeed, dt)
    const emote = r.anim === ANIM.cheer ? 'cheer' : r.anim === ANIM.defeat ? 'defeat' : null
    if (emote !== m.emote) {
      m.emote = emote
      m.emoteStart = m.time
    }
    m.grounded = r.anim !== 2
    // Their Boxity emote, until they move.
    if (r.boxityEmote && (r.boxityEmote.done || r.anim !== ANIM.idle || r.speed > 0.6)) r.boxityEmote = null
    m.boxity = r.boxityEmote
  })

  return (
    <group ref={groupRef}>
      <group ref={visualRef}>
        <PlayerAvatar remote={remote} targetHeight={1.8} motionRef={motionRef} />
      </group>
    </group>
  )
}

/**
 * Other players in our zone. Positions and name tags update for everyone; full
 * Bloxity avatars (6 skinned meshes each) are drawn only for the nearest few, as many
 * as the quality preset allows.
 */
export function RemotePlayers() {
  const ids = useGameStore((s) => s.remoteIds)
  const q = useQuality()
  const [shown, setShown] = useState([])

  useRemoteInterpolation()

  useEffect(() => {
    const pick = () => {
      const p = live.player
      const maxD = q.viewDistance * 0.6
      const next = ids
        .map((id) => {
          const r = live.remotes.get(id)
          return r ? { id, d: Math.hypot(r.x - p.x, r.z - p.z) } : null
        })
        .filter((e) => e && e.d < maxD)
        .sort((a, b) => a.d - b.d)
        .slice(0, q.remoteAvatars)
        .map((e) => e.id)
        .sort()
      setShown((prev) => (prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next))
    }
    pick()
    const timer = setInterval(pick, REFRESH_MS)
    return () => clearInterval(timer)
  }, [ids, q])

  return shown.map((id) => <RemotePlayer key={id} id={id} />)
}

export default RemotePlayers
