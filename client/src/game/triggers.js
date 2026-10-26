import {
  C2S,
  CRYSTAL_POSITION,
  PUMPKINS,
  RINGS,
  STAGE,
  WORLDS,
  WORLDS_PORTAL,
  capsuleNear,
  dist2d,
  inDoorway,
  nearGate,
  returnPad,
  ringAt,
  worldOfZone,
} from '@shared'

import { sfx } from '../audio/sfx'
import { send } from '../net/connection'
import { gameState, useGameStore } from '../store/gameStore'
import { live } from '../store/live'

/**
 * Proximity triggers, polled 10 times a second - outside the frame loop, so the
 * store is only ever written from here, never from useFrame.
 *
 * Standing at a ring trains; touching the next gate's glass fights that stage; the
 * yellow Return pad cashes out the run; the Worlds portal opens the world picker; a
 * world's exit door goes back to the lobby; walking over a pumpkin collects it. The
 * server re-checks every position; this just decides when to ask.
 */

const POLL_MS = 100
const cooldowns = new Map()
let wasInWorldsPortal = false

function ready(key, ms) {
  const now = Date.now()
  if ((cooldowns.get(key) || 0) > now) return false
  cooldowns.set(key, now + ms)
  return true
}

function sameNearby(a, b) {
  return (
    a.capsule === b.capsule &&
    a.ring === b.ring &&
    a.crystal === b.crystal &&
    a.portal === b.portal &&
    a.pad === b.pad &&
    a.returnPad === b.returnPad &&
    a.exit === b.exit
  )
}

/** The zone's stage line: touch the next gate to fight, step on a Return pad to cash out. */
function stageTriggers(p, nearby) {
  const world = worldOfZone(live.zone)
  if (!world) return
  const run = live.run && live.run.world === world ? live.run : null
  const cleared = run ? run.cleared : 0
  const k = cleared + 1
  if (k <= WORLDS[world].stageCount && nearGate(k, p)) {
    nearby.pad = k
    if (ready(`fight:${world}:${k}`, 3000)) send(C2S.fight, { world, stage: k })
  }
  for (let j = 1; j <= cleared; j += 1) {
    if (dist2d(p, returnPad(j)) < STAGE.returnPadRadius) {
      nearby.returnPad = true
      if (ready('return', 3000)) send(C2S.collectRun)
    }
  }
}

function lobbyTriggers(st, p, nearby) {
  // Training: only "enter" rings we may use, so pets don't orbit a locked dummy.
  let ring = ringAt(p)
  if (ring && st.profile.rebirths < RINGS[ring].rebirths) {
    if (ready(`locked:${ring}`, 4000)) st.toast(`${RINGS[ring].name} ring requires Rebirth ${RINGS[ring].rebirths}!`, 'error')
    ring = null
  }
  nearby.ring = ring
  if (ring !== live.ring) {
    live.ring = ring
    send(C2S.train, { ring })
  }

  nearby.capsule = capsuleNear(p, 6)
  nearby.crystal = dist2d(p, CRYSTAL_POSITION) < 6

  // The Worlds portal opens the world picker once per visit.
  const inPortal = inDoorway(WORLDS_PORTAL, p)
  if (inPortal) nearby.portal = 'worlds'
  if (inPortal && !wasInWorldsPortal && st.panel !== 'worlds') {
    sfx.teleport()
    useGameStore.setState({ panel: 'worlds' })
  }
  wasInWorldsPortal = inPortal

  const now = Date.now()
  for (const pk of PUMPKINS) {
    if ((live.pumpkins[pk.id] || 0) > now) continue
    if (dist2d(p, pk) < 2.3) {
      // Hide it right away; the server's reply sets the real respawn time.
      live.pumpkins = { ...live.pumpkins, [pk.id]: now + 5000 }
      send(C2S.pumpkin, { id: pk.id })
    }
  }
}

function poll() {
  const st = gameState()
  if (st.status !== 'online' || !st.profile) return
  const p = live.player
  const nearby = { capsule: null, ring: null, crystal: false, portal: null, pad: null, returnPad: false, exit: false }

  if (!live.battle) {
    stageTriggers(p, nearby)
    if (live.zone === 'lobby') {
      lobbyTriggers(st, p, nearby)
    } else if (inDoorway(STAGE.exitPortal, p)) {
      nearby.exit = true
      if (ready('exit', 3000)) send(C2S.teleport, { to: 'lobby' })
    }
  }

  if (!sameNearby(nearby, st.nearby)) useGameStore.setState({ nearby })
}

export function startTriggers() {
  const timer = setInterval(poll, POLL_MS)
  return () => clearInterval(timer)
}
