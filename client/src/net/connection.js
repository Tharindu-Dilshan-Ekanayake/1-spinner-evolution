import { Callbacks, Client } from '@colyseus/sdk'
import { C2S, LOBBY, S2C, SPINNERS, TRAILS, computeStats, formatNumber, rarityOf, spinnerStats } from '@shared'

import { playMusic } from '../audio/music'
import { sfx } from '../audio/sfx'
import { getBloxityState, useBloxityStore } from '../bloxity/store'
import { SERVER_URL } from '../config'
import { createBattle, endBattle, feedFrame } from '../game/battle/battleState'
import { gameState, useGameStore } from '../store/gameStore'
import { live, pushFx } from '../store/live'

/**
 * The Colyseus connection: join, keep other players mirrored into `live.remotes`,
 * and route every server message to the store (HUD), `live` (frame loop) or sounds.
 */

const GUEST_KEY = 'spinner_guest_id'
const GUEST_NAME_KEY = 'spinner_guest_name'
const LAST_IDENTITY_KEY = 'spinner_last_identity'
const MOVE_HZ = 12
const RECONNECT_MS = 3000

let client = null
let room = null
let moveTimer = null
let reconnectTimer = null
let connecting = false
let joinedUserId = null
let lastSent = [NaN, NaN, NaN, NaN, NaN]

function guestId() {
  try {
    let id = localStorage.getItem(GUEST_KEY)
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem(GUEST_KEY, id)
    }
    return id
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

function storage(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key)
    localStorage.setItem(key, value)
  } catch {
    // Private mode: nothing is remembered, everything still works.
  }
  return null
}

/**
 * A guest's display name. The SDK's own guest name when it has loaded, else the one
 * remembered from last time, else a fresh one - so guests can join before the SDK.
 */
function guestName(guest) {
  const fromSdk = guest?.displayName || guest?.username
  if (fromSdk) {
    storage(GUEST_NAME_KEY, fromSdk)
    return fromSdk
  }
  const saved = storage(GUEST_NAME_KEY)
  if (saved) return saved
  const made = `Spinner${Math.floor(Math.random() * 9000 + 1000)}`
  storage(GUEST_NAME_KEY, made)
  return made
}

function identity() {
  const { user, guest, equipped, proportions } = getBloxityState()
  return {
    userId: user?._id || user?.id || null,
    guestId: guestId(),
    name: user ? user.displayName || user.username || 'Player' : guestName(guest),
    avatar: JSON.stringify({ equipped: equipped || null, proportions: proportions || null }),
  }
}

/**
 * Whether the last session was signed in to Bloxity. Guests (the usual first visit)
 * join straight away; returning players wait for the SDK so their own save loads first.
 */
export function lastSessionWasUser() {
  return storage(LAST_IDENTITY_KEY) === 'user'
}

export function send(type, payload) {
  if (room) room.send(type, payload)
}

/* ---------------------------------------------------------------------------
 * Remote players
 * ------------------------------------------------------------------------- */

function refreshRemoteIds() {
  const ids = []
  for (const [id, r] of live.remotes) if (r.zone === live.zone) ids.push(id)
  ids.sort()
  const prev = gameState().remoteIds
  if (prev.length !== ids.length || prev.some((v, i) => v !== ids[i])) {
    useGameStore.setState({ remoteIds: ids })
  }
}

function copyPlayer(r, p) {
  r.name = p.name
  r.tx = p.x
  r.ty = p.y
  r.tz = p.z
  r.try = p.ry
  r.anim = p.anim
  if (r.level !== p.level || r.rebirths !== p.rebirths) {
    r.level = p.level
    r.rebirths = p.rebirths
    r.sub = p.rebirths ? `Lv ${p.level} • R${p.rebirths}` : `Lv ${p.level}`
  }
  r.trail = p.trail
  r.aura = p.aura
  r.ring = p.ring
  r.battling = p.battling
  r.avatar = p.avatar
  const zoneChanged = r.zone !== p.zone
  r.zone = p.zone
  if (zoneChanged) {
    // Snap instead of sliding across the map.
    r.x = p.x
    r.y = p.y
    r.z = p.z
    r.ry = p.ry
  }
  return zoneChanged
}

function syncTeam(r, p) {
  r.team.length = 0
  for (const code of p.team) {
    const golden = code.endsWith('*')
    const id = golden ? code.slice(0, -1) : code
    if (SPINNERS[id]) r.team.push({ id, golden })
  }
}

function bindState(r0) {
  const cb = Callbacks.get(r0)
  cb.onAdd('players', (p, sessionId) => {
    if (sessionId === r0.sessionId) return
    const r = {
      id: sessionId,
      x: p.x,
      y: p.y,
      z: p.z,
      ry: p.ry,
      team: [],
      zone: null,
      speed: 0,
      pets: null,
    }
    copyPlayer(r, p)
    syncTeam(r, p)
    live.remotes.set(sessionId, r)
    live.remoteList.push(r)
    cb.onChange(p, () => {
      if (copyPlayer(r, p)) refreshRemoteIds()
    })
    const teamChanged = () => syncTeam(r, p)
    cb.onAdd(p, 'team', teamChanged)
    cb.onRemove(p, 'team', teamChanged)
    cb.onChange(p, 'team', teamChanged)
    refreshRemoteIds()
  })
  cb.onRemove('players', (_p, sessionId) => {
    const r = live.remotes.get(sessionId)
    live.remotes.delete(sessionId)
    if (r) live.remoteList.splice(live.remoteList.indexOf(r), 1)
    refreshRemoteIds()
  })
}

/* ---------------------------------------------------------------------------
 * Messages
 * ------------------------------------------------------------------------- */

function teamFromProfile(profile) {
  const byUid = new Map(profile.inventory.map((s) => [s.uid, s]))
  const { hpMult } = computeStats(profile)
  return profile.equipped
    .map((uid) => byUid.get(uid))
    .filter(Boolean)
    .map((s) => {
      const hp = spinnerStats(s.id, s.golden).hp * hpMult
      return { id: s.id, golden: s.golden, uid: s.uid, hp, hpText: formatNumber(hp) }
    })
}

function setZone(zone, spot) {
  const changed = live.zone !== zone
  const p = live.player
  p.x = spot.x
  p.y = spot.y
  p.z = spot.z
  p.ry = spot.ry
  p.vx = 0
  p.vy = 0
  p.vz = 0
  p.warp += 1
  // The camera sits behind the avatar: opposite the way it faces.
  live.camera.yaw = spot.ry + Math.PI
  if (!changed) return
  live.zone = zone
  live.ring = null
  useGameStore.setState({ zone, fading: true, nearby: { capsule: null, ring: null, crystal: false, portal: null, pad: null, returnPad: false } })
  setTimeout(() => useGameStore.setState({ fading: false }), 450)
  playMusic(zone === 'lobby' ? 'lobby' : zone === 'grassland' ? 'lobby' : zone)
  refreshRemoteIds()
}

function bindMessages(r0) {
  const store = useGameStore

  r0.onMessage(S2C.profile, ({ profile, quest, daily }) => {
    live.team = teamFromProfile(profile)
    live.pumpkins = profile.pumpkins || {}
    live.player.speedMult = 1 + (TRAILS[profile.trail]?.speed || 0)
    live.profileCosmetics = { aura: profile.aura, trail: profile.trail }
    store.setState({ profile, quest, daily, giftsAt: Date.now() })
  })

  r0.onMessage(S2C.stats, (stats) => gameState().applyStats(stats))

  r0.onMessage(S2C.gain, (pairs) => {
    for (let i = 0; i < pairs.length; i += 1) live.gains.push(pairs[i])
    sfx.gain()
  })

  r0.onMessage(S2C.levelUp, ({ from, to }) => {
    store.setState({ levelUp: { from, to, at: Date.now() } })
    pushFx('levelUp', live.player.x, live.player.y, live.player.z)
    sfx.levelUp()
  })

  r0.onMessage(S2C.capsule, (msg) => store.setState({ opening: { ...msg, at: Date.now() } }))

  r0.onMessage(S2C.battleStart, (msg) => {
    live.battle = createBattle(msg)
    live.ring = null
    store.setState({ battle: { world: msg.world, stage: msg.stage, line: msg.line, startAt: Date.now() }, battleResult: null, panel: null })
    playMusic('battle')
  })

  r0.onMessage(S2C.battleFrame, (frame) => feedFrame(live.battle, frame))

  r0.onMessage(S2C.battleEnd, (msg) => {
    endBattle(live.battle, msg)
    store.setState({ battleResult: { ...msg, at: Date.now() } })
    if (msg.result === 'win') sfx.win()
    else sfx.lose()
    setTimeout(() => {
      live.battle = null
      store.setState({ battle: null })
      playMusic(live.zone === 'lobby' || live.zone === 'grassland' ? 'lobby' : live.zone)
    }, 2200)
  })

  r0.onMessage(S2C.run, (run) => {
    live.run = run
    store.setState({ run })
  })

  r0.onMessage(S2C.teleported, ({ zone, x, y, z, ry }) => {
    // During the battle outro, wait for the result screen before moving.
    const apply = () => {
      setZone(zone, { x, y, z, ry })
      sfx.teleport()
    }
    if (live.battle && live.battle.ended) setTimeout(apply, 1800)
    else apply()
  })

  r0.onMessage(S2C.toast, ({ text, kind }) => {
    gameState().toast(text, kind)
    if (kind === 'error') sfx.error()
    if (kind === 'rebirth') sfx.rebirth()
  })

  r0.onMessage(S2C.quest, (quest) => store.setState({ quest }))
  r0.onMessage(S2C.leaderboards, (leaderboards) => store.setState({ leaderboards }))

  r0.onMessage(S2C.reward, (msg) => {
    if (msg.pumpkin) {
      live.pumpkins = { ...live.pumpkins, [msg.pumpkin]: Date.now() + 90000 }
      pushFx('pickup', live.player.x, live.player.y + 1, live.player.z)
      sfx.pickup()
    } else {
      sfx.buy()
    }
    gameState().pushReward(msg)
  })

  r0.onMessage(S2C.fx, ({ t, id }) => {
    if (t === 'buy') return sfx.buy()
    if (t === 'potion') return sfx.potion()
    const who = id === r0.sessionId ? live.player : live.remotes.get(id)
    if (!who) return
    if (t === 'levelUp') pushFx('levelUp', who.x, who.y, who.z)
    if (t === 'rebirth') pushFx('rebirth', who.x, who.y, who.z)
  })

  r0.onMessage(S2C.pong, () => {})
}

/* ---------------------------------------------------------------------------
 * Movement upload
 * ------------------------------------------------------------------------- */

function startMoveLoop() {
  clearInterval(moveTimer)
  moveTimer = setInterval(() => {
    if (!room || live.battle) return
    const p = live.player
    const next = [
      Math.round(p.x * 100) / 100,
      Math.round(p.y * 100) / 100,
      Math.round(p.z * 100) / 100,
      Math.round(p.ry * 100) / 100,
      p.anim,
    ]
    if (next.every((v, i) => v === lastSent[i])) return
    lastSent = next
    room.send(C2S.move, next)
  }, 1000 / MOVE_HZ)
}

/* ---------------------------------------------------------------------------
 * Connect / reconnect
 * ------------------------------------------------------------------------- */

export async function connect() {
  if (connecting || room) return
  connecting = true
  clearTimeout(reconnectTimer)
  useGameStore.setState({ status: 'connecting', error: null })
  try {
    client = client || new Client(SERVER_URL)
    const id = identity()
    joinedUserId = id.userId
    performance.mark('net:join-start')
    const r0 = await client.joinOrCreate('world', id)
    performance.mark('net:joined')
    storage(LAST_IDENTITY_KEY, id.userId ? 'user' : 'guest')
    room = r0
    live.selfId = r0.sessionId
    live.remotes.clear()
    live.remoteList.length = 0
    live.zone = 'lobby'
    Object.assign(live.player, { x: LOBBY.spawn.x, y: 0, z: LOBBY.spawn.z, ry: LOBBY.spawn.ry, vx: 0, vy: 0, vz: 0 })
    live.camera.yaw = LOBBY.spawn.ry + Math.PI
    bindState(r0)
    bindMessages(r0)
    r0.onLeave(() => {
      room = null
      live.battle = null
      useGameStore.setState({ status: 'offline', battle: null })
      reconnectTimer = setTimeout(connect, RECONNECT_MS)
    })
    startMoveLoop()
    useGameStore.setState({ status: 'online', zone: 'lobby' })
    playMusic('lobby')
  } catch (err) {
    console.warn('[net] could not join', err)
    useGameStore.setState({ status: 'error', error: String(err?.message || err) })
    reconnectTimer = setTimeout(connect, RECONNECT_MS)
  } finally {
    connecting = false
  }
}

/** Logging in (or out) of Bloxity switches which save we play: rejoin. */
export function watchIdentity() {
  return useBloxityStore.subscribe((s, prev) => {
    const now = s.user?._id || s.user?.id || null
    const before = prev.user?._id || prev.user?.id || null
    if (now === before || now === joinedUserId) return
    if (room) {
      const r0 = room
      room = null
      r0.leave().finally(() => connect())
    }
  })
}

/** For the perf probe / debugging. */
export function getRoom() {
  return room
}

/** Sound + toast helper the UI uses before the server answers. */
export function rarityOrder(id) {
  return rarityOf(id).order
}
