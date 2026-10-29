import { Callbacks, Client } from '@colyseus/sdk'
import { C2S, LOBBY, S2C, SPINNERS, TRAILS, computeStats, formatNumber, rarityOf, spinnerStats } from '@shared'

import { playMusic } from '../audio/music'
import { sfx } from '../audio/sfx'
import { bloxityEnv } from '../bloxity/environment'
import { startEmote } from '../bloxity/emotes'
import { getSDK, safeCall, waitForSDK } from '../bloxity/sdk'
import { getBloxityState, useBloxityStore } from '../bloxity/store'
import { BLOXITY_HOSTING_ID, SERVER_URL } from '../config'
import { createBattle, endBattle, feedFrame } from '../game/battle/battleState'
import { gameState, useGameStore } from '../store/gameStore'
import { live, pushFx } from '../store/live'

/**
 * The Colyseus connection: join, keep other players mirrored into `live.remotes`,
 * and route every server message to the store (HUD), `live` (frame loop) or sounds.
 *
 * Hosted on Boxity (VITE_BLOXITY_HOSTING_ID set), every connect asks Boxity's
 * matchmaker for an endpoint first (Legion.SDK.net.resolveEndpoint) and builds a new
 * Client for it: that is what lets Boxity start more servers, keep parties together
 * and seat invited friends. Never connect to <id>.host.bloxity.io directly. Without a
 * hosting id (local dev, or a server hosted elsewhere) the game connects to SERVER_URL.
 */

const GUEST_KEY = 'spinner_guest_id'
const GUEST_NAME_KEY = 'spinner_guest_name'
const LAST_IDENTITY_KEY = 'spinner_last_identity'
const MOVE_HZ = 12
/** Retry delays grow to this; a cold Boxity server can take ~45 s to start. */
const RETRY_MAX_MS = 8000
const GIVE_UP_MS = 60000

let client = null
/** The endpoint `client` talks to (rejoining the same room reuses it). */
let endpoint = null
let room = null
let moveTimer = null
let reconnectTimer = null
let connecting = false
let joinedUserId = null
let lastSent = [NaN, NaN, NaN, NaN, NaN]
let failingSince = 0
let retries = 0
/** A room to join first, once: ?roomId= (Boxity's Join button, friend invites). */
let wantedRoomId = new URLSearchParams(window.location.search).get('roomId')

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
  const sdk = getSDK()
  return {
    // The server only trusts the token (checked with Boxity); the id is for the matchmaker.
    token: (user && safeCall(sdk?.auth?.getToken?.bind(sdk.auth))) || null,
    gameSlug: import.meta.env.VITE_GAME_SLUG || '',
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
  r.uid = p.uid
  // A new emote started (the seq ticks); the first sync only records where it is.
  if (r.emoteSeq !== undefined && r.emoteSeq !== p.emoteSeq) r.boxityEmote = startEmote(p.emote)
  r.emoteSeq = p.emoteSeq
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
  // Players there when we arrive vs. joining later (Boxity's friend-join toasts).
  let arriving = true
  r0.onStateChange.once(() => {
    arriving = false
  })
  cb.onAdd('players', (p, sessionId) => {
    if (sessionId === r0.sessionId) return
    const sdk = getSDK()
    if (arriving) safeCall(sdk?.game?.playerInRoom?.bind(sdk.game), p.name)
    else safeCall(sdk?.game?.playerJoined?.bind(sdk.game), p.name)
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
    sfx.buy()
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

/**
 * A Client for this connect. Hosted on Boxity: a fresh endpoint from the matchmaker
 * each time (each is pinned to one server, so a Client is never reused across them).
 */
async function openClient(id) {
  if (!BLOXITY_HOSTING_ID) {
    if (!client) client = new Client(SERVER_URL)
    endpoint = SERVER_URL
    return client
  }
  const sdk = await waitForSDK()
  const resolved = await sdk.net.resolveEndpoint(BLOXITY_HOSTING_ID, { userId: id.userId || id.guestId })
  endpoint = resolved.endpoint
  client = new Client(endpoint)
  return client
}

/** Joins the ?roomId= room if it still exists (on Boxity: on the server that holds it). */
async function joinWanted(id, roomId) {
  if (!BLOXITY_HOSTING_ID) return (await openClient(id)).joinById(roomId, id)
  const res = await fetch(`${bloxityEnv().playUrl}/v1/dir/${encodeURIComponent(BLOXITY_HOSTING_ID)}/list`)
  const body = await res.json()
  const list = Array.isArray(body) ? body : body?.rooms || []
  const entry = list.find((r) => r?.roomId === roomId || r?.id === roomId)
  if (!entry?.joinUrl) throw new Error('room not listed')
  endpoint = entry.joinUrl
  client = new Client(endpoint)
  return client.joinById(roomId, id)
}

/** Tries again a little later, backing off; gives up after a minute of failures. */
function retryLater(err) {
  if (!failingSince) failingSince = Date.now()
  if (Date.now() - failingSince > GIVE_UP_MS) {
    useGameStore.setState({ status: 'error', error: 'Could not reach the game server. Reload to try again.' })
    return
  }
  useGameStore.setState({ status: 'error', error: String(err?.message || err) })
  reconnectTimer = setTimeout(connect, Math.min(RETRY_MAX_MS, 1000 * 2 ** retries))
  retries += 1
}

/**
 * Joins (or rejoins) the world. `sameRoom` rejoins the room we were in, on the same
 * server - used when the player signs in mid-game, so they stay with their friends.
 */
export async function connect(sameRoom = null) {
  if (connecting || room) return
  connecting = true
  clearTimeout(reconnectTimer)
  useGameStore.setState({ status: 'connecting', error: null })
  try {
    const id = identity()
    joinedUserId = id.userId
    performance.mark('net:join-start')
    let r0 = null
    const target = sameRoom || (wantedRoomId ? { roomId: wantedRoomId } : null)
    wantedRoomId = null
    if (target) {
      try {
        r0 = target.endpoint ? await new Client(target.endpoint).joinById(target.roomId, id) : await joinWanted(id, target.roomId)
      } catch (err) {
        // Gone or full: fall back to normal matchmaking.
        console.warn('[net] could not rejoin room', target.roomId, err?.message || err)
      }
    }
    if (!r0) r0 = await (await openClient(id)).joinOrCreate('world', id)
    performance.mark('net:joined')
    failingSince = 0
    retries = 0
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
    // The lobby is joinable: tell Boxity, so friends can follow us in.
    const sdk = getSDK()
    safeCall(sdk?.game?.updateRoom?.bind(sdk.game), r0.roomId)
    r0.onLeave(() => {
      if (room !== r0) return // we left on purpose (see watchIdentity)
      room = null
      live.battle = null
      const now = getSDK()
      safeCall(now?.game?.updateRoom?.bind(now.game), '')
      useGameStore.setState({ status: 'offline', battle: null })
      // Closed under us: ask the matchmaker again (it may be a new server) and rejoin.
      reconnectTimer = setTimeout(connect, 1000)
    })
    startMoveLoop()
    useGameStore.setState({ status: 'online', zone: 'lobby' })
    playMusic('lobby')
  } catch (err) {
    console.warn('[net] could not join', err)
    retryLater(err)
  } finally {
    connecting = false
  }
}

/** Logging in (or out) of Bloxity switches which save we play: rejoin the same room. */
export function watchIdentity() {
  return useBloxityStore.subscribe((s, prev) => {
    const now = s.user?._id || s.user?.id || null
    const before = prev.user?._id || prev.user?.id || null
    if (now === before || now === joinedUserId) return
    if (room) {
      const r0 = room
      const sameRoom = { roomId: r0.roomId, endpoint }
      room = null
      r0.leave().finally(() => connect(sameRoom))
    }
  })
}

/** Plays a Boxity emote on our character and shows it to the room. */
export function playEmote(id) {
  if (live.battle) return
  const playing = startEmote(id)
  if (!playing) return
  live.player.boxityEmote = playing
  send(C2S.emote, { id })
}

/** For the perf probe / debugging. */
export function getRoom() {
  return room
}

/** Sound + toast helper the UI uses before the server answers. */
export function rarityOrder(id) {
  return rarityOf(id).order
}
