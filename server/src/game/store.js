import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MongoClient } from 'mongodb'

/**
 * Player saves.
 *
 * Two backends behind one API:
 *  - MongoDB, when MONGODB_URI is set (Boxity hosting injects it on every deploy): one
 *    document per player, loaded when the player joins and written back every few
 *    seconds and when they leave. Pods hold only the players in their rooms, so any
 *    number of pods can run and a pod can vanish at any time without losing a save.
 *  - One JSON file, for local development: everything in memory, flushed atomically
 *    (temp file + rename) so a crash mid-write never leaves a half-written save.
 *
 * Callers use getProfile / putProfile / markDirty as before. In Mongo mode a profile
 * must be loaded first with ensureProfiles() (WorldRoom does it before the join).
 */

const DATA_DIR =
  process.env.DATA_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data')
const FILE = path.join(DATA_DIR, 'players.json')
const AUTOSAVE_MS = 15000

/** key -> profile (Mongo mode: only the players currently on this pod). */
const profiles = new Map()
let dirty = false
let timer = null

/** @type {import('mongodb').Collection | null} */
let players = null
let mongo = null
/** key -> the JSON last written to Mongo, so unchanged saves are skipped. */
const written = new Map()

export const usesMongo = () => Boolean(players)

/**
 * Where the saves live. Mongo when the URI is set; otherwise the JSON file (local dev).
 * A `collection` can be passed in (tests use a fake one).
 */
export async function initStore({ collection } = {}) {
  if (collection || process.env.MONGODB_URI) {
    if (collection) players = collection
    else {
      mongo = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
      await mongo.connect()
      players = mongo.db().collection('players')
    }
    await players.createIndex({ wins: -1 })
    await players.createIndex({ rebirths: -1 })
    await players.createIndex({ playtime: -1 })
    console.log('[store] saving players to MongoDB')
    return
  }
  loadFile()
}

function loadFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(FILE)) return
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'))
    for (const [key, profile] of Object.entries(raw)) profiles.set(key, profile)
    console.log(`[store] loaded ${profiles.size} player save(s) from ${FILE}`)
  } catch (err) {
    // Keep the broken file for inspection instead of overwriting it on next save.
    const backup = `${FILE}.corrupt-${Date.now()}`
    fs.copyFileSync(FILE, backup)
    console.error(`[store] could not parse ${FILE}; copied to ${backup}`, err)
  }
}

export function getProfile(key) {
  return profiles.get(key) || null
}

/** Loads these players' saves into memory (Mongo mode; a no-op for the file store). */
export async function ensureProfiles(keys) {
  if (!players) return
  const missing = [...new Set(keys)].filter((k) => k && !profiles.has(k))
  if (!missing.length) return
  const docs = await players.find({ _id: { $in: missing } }).toArray()
  for (const doc of docs) {
    if (!doc.profile || profiles.has(doc._id)) continue
    profiles.set(doc._id, doc.profile)
    written.set(doc._id, JSON.stringify(doc.profile))
  }
}

export function putProfile(key, profile) {
  profiles.set(key, profile)
  dirty = true
}

export function markDirty() {
  dirty = true
}

/** Every save held in memory (the file store's whole set). */
export function allProfiles() {
  return profiles.values()
}

function documentOf(key, profile) {
  return {
    name: String(profile.name || ''),
    wins: Math.floor(profile.stats?.totalWins || 0),
    rebirths: profile.rebirths || 0,
    playtime: Math.floor(profile.stats?.playtime || 0),
    updatedAt: new Date(),
    profile,
  }
}

async function flushMongo(only) {
  const ops = []
  for (const key of only || profiles.keys()) {
    const profile = profiles.get(key)
    if (!profile) continue
    const json = JSON.stringify(profile)
    if (written.get(key) === json) continue
    ops.push({ key, json, op: { updateOne: { filter: { _id: key }, update: { $set: documentOf(key, profile) }, upsert: true } } })
  }
  if (!ops.length) return
  await players.bulkWrite(ops.map((o) => o.op), { ordered: false })
  for (const o of ops) written.set(o.key, o.json)
}

/** Writes every unsaved change. Returns a promise (immediately done for the file store). */
export async function saveNow() {
  if (players) {
    await flushMongo()
    dirty = false
    return
  }
  if (!dirty) return
  const tmp = `${FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(profiles)))
  fs.renameSync(tmp, FILE)
  dirty = false
}

/** A player left: save them, and (Mongo mode) free their memory. */
export async function releaseProfile(key) {
  if (!players) return
  try {
    await flushMongo([key])
  } catch (err) {
    console.error('[store] could not save', key, err)
    return // keep it in memory; the next autosave retries
  }
  profiles.delete(key)
  written.delete(key)
}

/**
 * The lobby boards' top rows straight from Mongo (Mongo mode only; the file store
 * computes them from memory, see leaderboard.js).
 * @param {'wins'|'rebirths'|'playtime'} field
 */
export async function topPlayers(field, limit) {
  if (!players) return []
  const docs = await players
    .find({ [field]: { $gt: 0 } }, { projection: { name: 1, [field]: 1 } })
    .sort({ [field]: -1 })
    .limit(limit)
    .toArray()
  return docs.map((d) => ({ name: d.name, value: d[field] }))
}

export function startAutosave() {
  if (timer) return
  timer = setInterval(() => {
    saveNow().catch((err) => console.error('[store] autosave failed', err))
  }, AUTOSAVE_MS)
  timer.unref?.()
}
