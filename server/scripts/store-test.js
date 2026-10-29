/**
 * Tests the MongoDB save store against an in-memory stand-in for the collection (no
 * database needed): loading on demand, skipping unchanged saves, release on leave, and
 * the leaderboard queries.
 *
 *   node scripts/store-test.js
 */
import { ensureProfiles, getProfile, initStore, putProfile, releaseProfile, saveNow, topPlayers, usesMongo } from '../src/game/store.js'

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg)
    process.exit(1)
  }
  console.log('ok  -', msg)
}

const docs = new Map()
let writes = 0
const fake = {
  async createIndex() {},
  find(filter, opts = {}) {
    let rows = [...docs.values()]
    if (filter._id?.$in) rows = rows.filter((d) => filter._id.$in.includes(d._id))
    for (const [k, v] of Object.entries(filter)) if (v?.$gt !== undefined) rows = rows.filter((d) => d[k] > v.$gt)
    const cursor = {
      sort(spec) {
        const [[k, dir]] = Object.entries(spec)
        rows = [...rows].sort((a, b) => (b[k] - a[k]) * (dir < 0 ? 1 : -1))
        return cursor
      },
      limit(n) {
        rows = rows.slice(0, n)
        return cursor
      },
      async toArray() {
        return rows.map((r) => (opts.projection ? { _id: r._id, ...Object.fromEntries(Object.keys(opts.projection).map((k) => [k, r[k]])) } : r))
      },
    }
    return cursor
  },
  async bulkWrite(ops) {
    for (const { updateOne } of ops) {
      writes += 1
      docs.set(updateOne.filter._id, { _id: updateOne.filter._id, ...updateOne.update.$set })
    }
  },
}

await initStore({ collection: fake })
assert(usesMongo(), 'the Mongo store is active')

const profile = { name: 'Ann', rebirths: 2, stats: { totalWins: 40, playtime: 600 }, wins: 5 }
putProfile('u:ann', profile)
putProfile('g:bob', { name: 'Bob', rebirths: 0, stats: { totalWins: 7, playtime: 90 } })
await saveNow()
assert(docs.size === 2 && docs.get('u:ann').wins === 40 && docs.get('u:ann').profile.wins === 5, 'saves are written as one document per player')

const before = writes
await saveNow()
assert(writes === before, 'unchanged saves are not written again')
profile.wins = 9
await saveNow()
assert(writes === before + 1 && docs.get('u:ann').profile.wins === 9, 'a changed save is written once')

await releaseProfile('u:ann')
assert(getProfile('u:ann') === null, 'a released player leaves memory')
await ensureProfiles(['u:ann', 'u:nobody'])
assert(getProfile('u:ann')?.wins === 9 && getProfile('u:nobody') === null, 'a save is loaded back from the database on join')

const top = await topPlayers('wins', 10)
assert(top.length === 2 && top[0].name === 'Ann' && top[0].value === 40, 'leaderboard rows come from the database')
console.log('\nStore test passed.')
process.exit(0)
