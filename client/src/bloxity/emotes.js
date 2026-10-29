import { Euler, Quaternion } from 'three'

import { EMOTE_ID } from '@shared'

import { bloxityEnv } from './environment'

/**
 * Boxity emotes. Boxity draws the emote picker itself; the game only plays what it
 * is told (Legion.SDK.player.onEvent 'play_emote', see platform.js) on the player's
 * character and replicates it to the room.
 *
 * Clips come from Boxity's catalogue, fetched once: { id, name, clip: { len, loop,
 * tracks } }, where tracks maps a bone name to [[timeSeconds, xDeg, yDeg, zDeg], ...]:
 * rotations in degrees over the bind pose, euler XYZ, multiplied onto the bone's bind
 * rotation, eased with smoothstep between keys. Unknown ids and bones are ignored.
 */

const BLEND_IN = 0.1
const D2R = Math.PI / 180

/** id -> clip */
let clips = new Map()
let loading = null

/** Fetches the catalogue (once; a failure just means no emotes this session). */
export function loadEmotes() {
  if (!loading) {
    loading = fetch(`${bloxityEnv().apiUrl}/v1/avatar/emotes`)
      .then((res) => (res.ok ? res.json() : []))
      .then((body) => {
        const list = Array.isArray(body) ? body : Array.isArray(body?.emotes) ? body.emotes : []
        const next = new Map()
        for (const e of list) {
          const clip = e?.clip
          if (typeof e?.id === 'string' && clip && clip.tracks && Number(clip.len) > 0) next.set(e.id, clip)
        }
        clips = next
      })
      .catch(() => {
        loading = null
      })
  }
  return loading
}

/**
 * A playing emote for `id`, or null when the id isn't a known emote.
 * `start` is filled in by the first frame that plays it (in that character's clock).
 */
export function startEmote(id) {
  if (typeof id !== 'string' || !EMOTE_ID.test(id)) return null
  const clip = clips.get(id)
  return clip ? { id, clip, start: null, done: false } : null
}

const _euler = new Euler()
const _delta = new Quaternion()
const _target = new Quaternion()
const _key = [0, 0, 0]

/** Track value at time t: held outside the keys, smoothstepped between them. */
function sample(keys, t) {
  const first = keys[0]
  const last = keys[keys.length - 1]
  let a = first
  let b = first
  if (t <= first[0]) b = first
  else if (t >= last[0]) a = b = last
  else {
    for (let i = 1; i < keys.length; i += 1) {
      if (keys[i][0] >= t) {
        a = keys[i - 1]
        b = keys[i]
        break
      }
    }
  }
  const span = b[0] - a[0]
  const s = span > 0 ? (t - a[0]) / span : 0
  const k = s * s * (3 - 2 * s)
  _key[0] = a[1] + (b[1] - a[1]) * k
  _key[1] = a[2] + (b[2] - a[2]) * k
  _key[2] = a[3] + (b[3] - a[3]) * k
  return _key
}

/**
 * Poses the rig for one frame of a playing emote, over whatever pose the frame already
 * has (run it after animateRig). Marks it `done` when a non-looping clip ends.
 *
 * @param {object} rig from collectRig
 * @param {{ clip: object, start: number|null, done: boolean }} playing from startEmote
 * @param {number} now the character's animation clock, in seconds
 */
export function applyEmote(rig, playing, now) {
  if (!rig?.bones || !playing) return
  if (playing.start === null) playing.start = now
  const { clip } = playing
  const elapsed = now - playing.start
  const len = Number(clip.len)
  if (!clip.loop && elapsed > len) {
    playing.done = true
    return
  }
  const t = clip.loop ? elapsed % len : elapsed
  const weight = Math.min(1, elapsed / BLEND_IN)
  for (const name in clip.tracks) {
    const entry = rig.bones[name]
    const keys = clip.tracks[name]
    if (!entry || !Array.isArray(keys) || !keys.length) continue
    const [x, y, z] = sample(keys, t)
    _euler.set(x * D2R, y * D2R, z * D2R, 'XYZ')
    _target.copy(entry.origQuat).multiply(_delta.setFromEuler(_euler))
    entry.bone.quaternion.slerp(_target, weight)
  }
}
