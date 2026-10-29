import {
  C2S,
  CRYSTAL_POSITION,
  LOBBY,
  RINGS,
  RING_LIST,
  RING_POSITIONS,
  STAGE,
  WORLDS,
  WORLDS_PORTAL,
  dist2d,
  inDoorway,
  onPlayerPad,
  returnPad,
  ringAt,
  shopPadNear,
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
 * Standing at a ring trains; standing on the next stage's blue pad fights it; the
 * yellow Return pad cashes out the run; the Worlds portal opens the world picker; a
 * world's exit door goes back to the lobby. The
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
    a.shopPad === b.shopPad &&
    a.ring === b.ring &&
    a.padHint === b.padHint &&
    a.crystal === b.crystal &&
    a.portal === b.portal &&
    a.pad === b.pad &&
    a.returnPad === b.returnPad &&
    a.exit === b.exit &&
    a.onStages === b.onStages
  )
}

/** Cleared stages whose pad you have stepped off since the last fight (see stageTriggers). */
const replayArmed = new Set()

/** In the lobby, the stage line starts here (z): nearer the spawn you're in the hub. */
const STAGES_FROM_Z = -14

/** The zone's stage line: stand on the next blue pad to fight, a Return pad to cash out. */
function stageTriggers(p, nearby) {
  const world = worldOfZone(live.zone)
  if (!world) return
  const run = live.run && live.run.world === world ? live.run : null
  const cleared = run ? run.cleared : 0
  // A new run (or none) starts with nothing armed: a pad you stepped off in an earlier
  // run must not start a replay the moment you win its stage again.
  if (cleared === 0) replayArmed.clear()
  const k = cleared + 1
  if (k <= WORLDS[world].stageCount && onPlayerPad(k, p)) {
    nearby.pad = k
    if (ready(`fight:${world}:${k}`, 3000)) send(C2S.fight, { world, stage: k })
  }
  // Stages already cleared in this run can be fought again for their wins. A replay
  // starts only after you have stepped off that pad: standing on it after a win would
  // otherwise start the next fight by itself, forever.
  for (let j = 1; j <= cleared && j <= WORLDS[world].stageCount; j += 1) {
    if (!onPlayerPad(j, p)) {
      replayArmed.add(j)
    } else if (replayArmed.has(j)) {
      nearby.pad = j
      if (ready(`fight:${world}:${j}`, 3000)) {
        replayArmed.delete(j)
        send(C2S.fight, { world, stage: j })
      }
    }
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
  // Next to a ring but not on its pad: point at the pad.
  if (!ring) {
    for (const r of RING_LIST) {
      if (dist2d(p, RING_POSITIONS[r.id]) < LOBBY.ringRadius + 6) nearby.padHint = r.id
    }
  }
  if (ring !== live.ring) {
    live.ring = ring
    send(C2S.train, { ring })
  }

  nearby.shopPad = shopPadNear(p)
  nearby.crystal = dist2d(p, CRYSTAL_POSITION) < 4.4

  // The Worlds portal opens the world picker once per visit.
  const inPortal = inDoorway(WORLDS_PORTAL, p)
  if (inPortal) nearby.portal = 'worlds'
  if (inPortal && !wasInWorldsPortal && st.panel !== 'worlds') {
    sfx.teleport()
    useGameStore.setState({ panel: 'worlds' })
  }
  wasInWorldsPortal = inPortal
}

function poll() {
  const st = gameState()
  if (st.status !== 'online' || !st.profile) return
  const p = live.player
  // Whether we're out on the stages (the run's banner only shows there).
  const onStages = live.zone !== 'lobby' || p.z < STAGES_FROM_Z
  const nearby = { shopPad: null, ring: null, padHint: null, crystal: false, portal: null, pad: null, returnPad: false, exit: false, onStages }

  if (live.battle) {
    // Standing on the pad through a fight doesn't count as having stepped off it.
    replayArmed.clear()
  } else {
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
