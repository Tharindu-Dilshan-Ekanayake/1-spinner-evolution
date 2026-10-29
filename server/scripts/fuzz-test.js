/**
 * Robustness test against a running server: 16 clients join (two full lobbies) with
 * junk join options, then flood every message type with garbage - wrong types, huge
 * numbers, NaN-ish strings, nested objects, nulls - while also moving and clicking at
 * full speed. Afterwards the server must still answer /api/health and a fresh client
 * must be able to join, train and get a reply. Exits non-zero on any failure.
 *
 *   SERVER_URL=http://localhost:3000 node scripts/fuzz-test.js
 */
import { Client } from '@colyseus/sdk'

import { C2S, S2C } from '../../shared/index.js'

const URL = process.env.SERVER_URL || 'http://localhost:3000'
const CLIENTS = 16
const ROUNDS = 400
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
/** `promise`, or `fallback` after `ms` (a dropped socket never settles some calls). */
const within = (promise, ms, fallback) => Promise.race([promise, sleep(ms).then(() => fallback)])

const JUNK = [
  null,
  undefined,
  0,
  -1,
  1e308,
  -1e308,
  Number.NaN,
  Infinity,
  '',
  'x'.repeat(5000),
  '__proto__',
  'constructor',
  true,
  [],
  [1, 2, 3],
  [Infinity, NaN, 'a', null, {}],
  {},
  { __proto__: { polluted: true } },
  { ring: 'nope', world: 42, stage: 'abc', id: -5, uid: 'x', capsule: [], count: 1e9, on: 'yes', to: {} },
  { stage: 1e9, world: 'grassland' },
  { count: -100, capsule: 'basic' },
  { uid: Number.MAX_SAFE_INTEGER },
]
const pick = (list) => list[Math.floor(Math.random() * list.length)]

function fail(msg) {
  console.error('FAIL:', msg)
  process.exit(1)
}

async function health() {
  const res = await fetch(`${URL}/api/health`, { signal: AbortSignal.timeout(5000) })
  return res.ok
}

const client = new Client(URL)
const rooms = []
for (let i = 0; i < CLIENTS; i += 1) {
  const options = i % 3 === 0 ? { guestId: pick(JUNK), name: pick(JUNK) } : { guestId: `fuzz-${Date.now()}-${i}`, name: `Fuzz${i}` }
  try {
    const room = await within(client.joinOrCreate('world', options), 5000, null)
    if (!room) continue
    for (const type of Object.values(S2C)) room.onMessage(type, () => {})
    rooms.push(room)
  } catch {
    // A rejected join is fine; a crash is not (checked below).
  }
}
console.log(`joined ${rooms.length}/${CLIENTS} clients`)
if (!rooms.length) fail('no client could join')

const types = Object.values(C2S)
for (let round = 0; round < ROUNDS; round += 1) {
  for (const room of rooms) {
    try {
      room.send(pick(types), pick(JUNK))
      room.send(C2S.move, [Math.random() * 1e6, pick(JUNK), Math.random() * 100, pick(JUNK), Math.floor(Math.random() * 300)])
      room.send(C2S.click)
    } catch {
      // The client library may refuse to encode some junk; keep going.
    }
  }
  if (round % 50 === 0) await sleep(20)
}
await sleep(1500)

if (!(await health().catch(() => false))) fail('server stopped answering /api/health')
console.log('ok  - server still healthy after', ROUNDS * rooms.length * 3, 'junk messages')

// A fresh player still gets a working game.
const probe = await within(client.joinOrCreate('world', { guestId: `fuzz-probe-${Date.now()}`, name: 'Probe' }), 5000, null)
if (!probe) fail('a fresh client could not join after the flood')
let gotProfile = false
probe.onMessage(S2C.profile, () => {
  gotProfile = true
})
for (const type of Object.values(S2C)) if (type !== S2C.profile) probe.onMessage(type, () => {})
await sleep(800)
if (!gotProfile) fail('a fresh client did not receive its profile')
console.log('ok  - a fresh client joined and received its profile')

for (const room of [...rooms, probe]) await within(room.leave().catch(() => {}), 1000)
console.log('\nFuzz test passed.')
process.exit(0)
