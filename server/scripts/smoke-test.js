/**
 * End-to-end smoke test against a running server (npm start in another terminal):
 * joins as a fresh guest, trains, levels up, enters Grassland, fights Stage 1,
 * cashes out the run, and checks lobbies cap at 8 players. Exits non-zero on any failure.
 *
 *   SERVER_URL=http://localhost:3000 node scripts/smoke-test.js
 */
import { Client } from '@colyseus/sdk'

import { C2S, S2C, SHOP_ITEMS, TRAIN_PAD, gateZ, playerPad, returnPad, trainPad } from '../../shared/index.js'

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
assert(last[S2C.profile].profile.tutorialDone === false, 'a new player gets the first-time tutorial')
assert(room.state.players.size >= 1, 'own player is in the synced state')

// Train at the Beginner ring: stand on its training pad.
const ring = trainPad('beginner')
room.send(C2S.move, [ring.x, TRAIN_PAD.top, ring.z, 0, 0])
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

// Touching the gate does nothing now: you walk in, and only the blue pad starts it.
room.send(C2S.train, { ring: null })
room.send(C2S.move, [0, 0, gateZ(1) + 1.2, Math.PI, 0])
await sleep(150)
room.send(C2S.fight, { world: 'grassland', stage: 1 })
await sleep(300)
assert(!last[S2C.battleStart], 'standing at the gate does not start a match')

// Walk through the open gate onto stage 1's blue pad.
const pad = playerPad(1)
room.send(C2S.move, [pad.x, 0.49, pad.z, Math.PI, 0])
await sleep(150)
room.send(C2S.fight, { world: 'grassland', stage: 1 })
await sleep(300)
assert(last[S2C.battleStart]?.stage === 1, `battle started with ${last[S2C.battleStart]?.units?.length} units`)
assert(last[S2C.teleported]?.zone === 'lobby' && Math.abs(last[S2C.teleported].z - pad.z) < 0.01, 'standing on the blue pad behind gate 1')
for (let i = 0; i < 300 && !last[S2C.battleEnd]; i += 1) {
  room.send(C2S.click)
  await sleep(100)
}
assert(last[S2C.battleEnd]?.result === 'win', `won stage 1 (${inbox[S2C.battleFrame]} frames)`)
assert(last[S2C.run]?.cleared === 1, 'run shows stage 1 cleared (gate 2 opens)')

// Stages go in order: stage 3's pad does nothing before stage 2 is beaten.
const battlesBefore = inbox[S2C.battleStart]
room.send(C2S.move, [playerPad(3).x, 0.49, playerPad(3).z, Math.PI, 0])
await sleep(100)
room.send(C2S.fight, { world: 'grassland', stage: 3 })
await sleep(300)
assert(inbox[S2C.battleStart] === battlesBefore, 'cannot skip ahead to stage 3')

// A stage already cleared in this run can be fought again for its wins, and winning it
// never sets the run back.
const starts = inbox[S2C.battleStart]
last[S2C.battleEnd] = null
room.send(C2S.move, [pad.x, 0.49, pad.z, Math.PI, 0])
await sleep(150)
room.send(C2S.fight, { world: 'grassland', stage: 1 })
await sleep(300)
assert(inbox[S2C.battleStart] === starts + 1 && last[S2C.battleStart].stage === 1, 'stage 1 can be fought again after clearing it')
for (let i = 0; i < 300 && !last[S2C.battleEnd]; i += 1) {
  room.send(C2S.click)
  await sleep(100)
}
assert(last[S2C.battleEnd]?.result === 'win' && last[S2C.battleEnd].run.cleared === 1, `replay won and the run stayed at stage 1 cleared (wins in run: ${last[S2C.battleEnd]?.run.wins})`)

// Enough wins for the cheapest spinner? If not, fight stage 1 again (replays pay).
const cheapest = SHOP_ITEMS.basic.cost
for (let n = 0; n < 15 && last[S2C.profile].profile.wins + last[S2C.run].wins < cheapest; n += 1) {
  room.send(C2S.move, [pad.x + 4, 0.49, pad.z, Math.PI, 0])
  await sleep(120)
  room.send(C2S.move, [pad.x, 0.49, pad.z, Math.PI, 0])
  await sleep(120)
  last[S2C.battleEnd] = null
  room.send(C2S.fight, { world: 'grassland', stage: 1 })
  for (let i = 0; i < 300 && !last[S2C.battleEnd]; i += 1) {
    room.send(C2S.click)
    await sleep(100)
  }
}

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
assert(last[S2C.profile].profile.tutorialDone === false, 'tutorial goes on after banking: next, spend the wins')

// Spend the wins: buy the Basic Spinner (no capsules: you pick the spinner). It reports
// whether it joined the team.
const winsBeforeBuy = last[S2C.profile].profile.wins
room.send(C2S.buySpinner, { id: 'basic' })
await sleep(400)
const bought = last[S2C.capsule]
assert(bought?.capsule === 'buy' && bought.results[0].id === 'basic' && typeof bought.results[0].equipped === 'boolean', `bought the Basic Spinner (on team: ${bought?.results[0].equipped})`)
assert(last[S2C.profile].profile.wins === winsBeforeBuy - cheapest, `it cost its price: ${winsBeforeBuy} -> ${last[S2C.profile].profile.wins} wins`)
assert(last[S2C.profile].profile.tutorialDone === true, 'the first spinner bought finished the tutorial')

// Lobbies hold 8 players: nine more joiners can never share one room.
const extra = []
for (let i = 0; i < 9; i += 1) {
  const r = await client.joinOrCreate('world', { guestId: `smoke-cap-${Date.now()}-${i}`, name: `Cap${i}` })
  for (const type of Object.values(S2C)) r.onMessage(type, () => {})
  extra.push(r)
}
const perRoom = {}
for (const r of [room, ...extra]) perRoom[r.roomId] = (perRoom[r.roomId] || 0) + 1
assert(Math.max(...Object.values(perRoom)) <= 8, `no room holds more than 8 players (${JSON.stringify(Object.values(perRoom))})`)
for (const r of extra) await r.leave()

await room.leave()
console.log('\nSmoke test passed.')
process.exit(0)
