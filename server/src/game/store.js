import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Player saves, kept in memory and flushed to one JSON file.
 *
 * Deliberately dependency-free: no native modules to build on Windows, and the whole
 * save set of a small game fits comfortably in memory. Writes are atomic (temp file +
 * rename) so a crash mid-write can never leave a half-written save behind.
 *
 * Swap this module for a real database when the player count outgrows a single file;
 * nothing else touches the file directly.
 */

const DATA_DIR =
  process.env.DATA_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data')
const FILE = path.join(DATA_DIR, 'players.json')
const AUTOSAVE_MS = 15000

/** key -> profile */
const profiles = new Map()
let dirty = false
let timer = null

export function loadStore() {
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

export function putProfile(key, profile) {
  profiles.set(key, profile)
  dirty = true
}

export function markDirty() {
  dirty = true
}

export function allProfiles() {
  return profiles.values()
}

export function saveNow() {
  if (!dirty) return
  const tmp = `${FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(profiles)))
  fs.renameSync(tmp, FILE)
  dirty = false
}

export function startAutosave() {
  if (timer) return
  timer = setInterval(() => {
    try {
      saveNow()
    } catch (err) {
      console.error('[store] autosave failed', err)
    }
  }, AUTOSAVE_MS)
  timer.unref?.()
}
