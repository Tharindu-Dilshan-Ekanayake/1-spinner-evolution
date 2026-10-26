/**
 * End-to-end smoke test against a running server (npm start in another terminal):
 * joins as a fresh guest, trains, levels up, enters Grassland, fights Stage 1 and
 * cashes out the run. Exits non-zero on any failure.
 *
 *   SERVER_URL=http://localhost:3000 node scripts/smoke-test.js
 */
import { Client } from '@colyseus/sdk'

import { C2S, RING_POSITIONS, S2C, gateZ, playerPad, returnPad } from '../../shared/index.js'

const URL = process.env.SERVER_URL || 'http://localhost:3000'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg)
    process.exit(1)
  }
  console.log('ok  -', msg)
}

const client = new Client(URL)
const room = await client.joinOrCreate('world', {
  guestId: `smoke-${Date.now()}`,
  name: 'SmokeTester',
})

const inbox = {}
const last = {}
for (const type of Object.values(S2C)) {
  room.onMessage(type, (msg) => {
    inbox[type] = (inbox[type] || 0) + 1
    last[type] = msg
  })
}

await sleep(500)
assert(last[S2C.profile]?.profile?.level === 1, 'received a fresh level-1 profile')
assert(last[S2C.profile].profile.equipped.length === 1, 'starts with one equipped spinner')
assert(room.state.players.size >= 1, 'own player is in the synced state')

// Train at the Beginner ring.
const ring = RING_POSITIONS.beginner
room.send(C2S.move, [ring.x + 9.5, 0, ring.z, 0, 0])
await sleep(100)
room.send(C2S.train, { ring: 'beginner' })
// Train until the first level-up (about 10-15s with one spinner).
for (let i = 0; i < 300 && !inbox[S2C.levelUp]; i += 1) {
  room.send(C2S.click)
  await sleep(100)
}
assert((inbox[S2C.gain] || 0) > 5, `training produced gain events (${inbox[S2C.gain]})`)
assert(inbox[S2C.levelUp] > 0, 'levelled up while training')
await sleep(300)
assert(last[S2C.capsule]?.capsule === 'gift', 'Level 2 opened a slot and gifted a spinner (+1 SPINNER)')
assert(last[S2C.profile].profile.equipped.length === 2, 'now 2 spinners equipped')

// Walk up to the Stage 1 gate (in front of the lobby) and touch its glass.
room.send(C2S.train, { ring: null })
room.send(C2S.move, [0, 0, gateZ(1) + 1.2, Math.PI, 0])
await sleep(150)
room.send(C2S.fight, { world: 'grassland', stage: 1 })
await sleep(300)
assert(last[S2C.battleStart]?.stage === 1, `battle started with ${last[S2C.battleStart]?.units?.length} units`)
const pad = playerPad(1)
assert(last[S2C.teleported]?.zone === 'lobby' && Math.abs(last[S2C.teleported].z - pad.z) < 0.01, 'placed on the blue pad behind gate 1')
for (let i = 0; i < 300 && !last[S2C.battleEnd]; i += 1) {
  room.send(C2S.click)
  await sleep(100)
}
assert(last[S2C.battleEnd]?.result === 'win', `won stage 1 (${inbox[S2C.battleFrame]} frames)`)
assert(last[S2C.run]?.cleared === 1, 'run shows stage 1 cleared (gate 1 opens)')

// Gates only open in order: stage 3 can't be fought before stage 2.
const battlesBefore = inbox[S2C.battleStart]
room.send(C2S.move, [0, 0, gateZ(3) + 1.2, Math.PI, 0])
await sleep(100)
room.send(C2S.fight, { world: 'grassland', stage: 3 })
await sleep(300)
assert(inbox[S2C.battleStart] === battlesBefore, 'cannot skip ahead to stage 3')

// The Return pad past arena 1 cashes out and goes back to the lobby spawn.
const rp = returnPad(1)
room.send(C2S.move, [rp.x, 0, rp.z, 0, 0])
await sleep(150)
const winsBefore = last[S2C.profile].profile.wins
room.send(C2S.collectRun)
await sleep(400)
assert(last[S2C.teleported]?.zone === 'lobby' && Math.abs(last[S2C.teleported].z) < 0.01, 'Return pad sent us to the lobby spawn')
assert(last[S2C.profile].profile.wins > winsBefore, `wins went ${winsBefore} -> ${last[S2C.profile].profile.wins}`)
assert(last[S2C.run] === null, 'run is over')

await room.leave()
console.log('\nSmoke test passed.')
process.exit(0)
