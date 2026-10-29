import { getAudio, onAudioReady } from './audio'

/**
 * Procedural background music: a tiny step sequencer (bass, pad, arpeggio, drums)
 * with one loop per mood. Notes are scheduled ~120 ms ahead on the AudioContext clock
 * so timing stays tight even when the main thread is busy.
 *
 * playMusic('lobby' | 'battle' | 'lava' | 'galaxy') cross-fades.
 */

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12)

// Chords as MIDI notes (root first). One chord per bar, 16 steps per bar.
const TRACKS = {
  lobby: {
    bpm: 112,
    chords: [
      [60, 64, 67],
      [55, 59, 62],
      [57, 60, 64],
      [53, 57, 60],
    ],
    arp: [0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 2, 1, 0, 1],
    arpOctave: 12,
    lead: 'square',
    kick: [0, 8],
    snare: [4, 12],
    hat: 2,
    bass: [0, 3, 6, 8, 11, 14],
  },
  battle: {
    bpm: 140,
    chords: [
      [57, 60, 64],
      [53, 57, 60],
      [60, 64, 67],
      [55, 59, 62],
    ],
    arp: [0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2, 0, 2, 1, 2],
    arpOctave: 12,
    lead: 'sawtooth',
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hat: 1,
    bass: [0, 2, 4, 6, 8, 10, 12, 14],
  },
  lava: {
    bpm: 124,
    chords: [
      [52, 55, 59],
      [48, 52, 55],
      [50, 53, 57],
      [47, 50, 54],
    ],
    arp: [0, 1, 2, 1, 2, 1, 0, 1, 0, 1, 2, 1, 2, 1, 0, 2],
    arpOctave: 12,
    lead: 'square',
    kick: [0, 6, 8],
    snare: [4, 12],
    hat: 2,
    bass: [0, 3, 6, 8, 10, 14],
  },
  galaxy: {
    bpm: 104,
    chords: [
      [62, 65, 69, 72],
      [58, 62, 65, 69],
      [60, 64, 67, 71],
      [57, 60, 64, 67],
    ],
    arp: [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 3, 1, 2, 0, 3],
    arpOctave: 12,
    lead: 'sine',
    kick: [0, 10],
    snare: [8],
    hat: 4,
    bass: [0, 6, 8, 14],
  },
}

let current = null
let wanted = 'lobby'
let timer = null

function voice(a, out, { freq, type, t, dur, vol, detune = 0 }) {
  const osc = a.ctx.createOscillator()
  const g = a.ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  osc.detune.value = detune
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(out)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

function drum(a, out, kind, t) {
  if (kind === 'kick') {
    const osc = a.ctx.createOscillator()
    const g = a.ctx.createGain()
    osc.frequency.setValueAtTime(140, t)
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.14)
    g.gain.setValueAtTime(0.5, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    osc.connect(g).connect(out)
    osc.start(t)
    osc.stop(t + 0.2)
    return
  }
  const src = a.ctx.createBufferSource()
  src.buffer = a.noise
  const f = a.ctx.createBiquadFilter()
  f.type = kind === 'hat' ? 'highpass' : 'bandpass'
  f.frequency.value = kind === 'hat' ? 7000 : 1800
  const g = a.ctx.createGain()
  const dur = kind === 'hat' ? 0.04 : 0.14
  g.gain.setValueAtTime(kind === 'hat' ? 0.06 : 0.22, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(out)
  src.start(t, Math.random() * 0.5)
  src.stop(t + dur + 0.02)
}

function startTrack(name) {
  const a = getAudio()
  if (!a) return
  const track = TRACKS[name] || TRACKS.lobby
  const out = a.ctx.createGain()
  out.gain.setValueAtTime(0.0001, a.ctx.currentTime)
  out.gain.exponentialRampToValueAtTime(1, a.ctx.currentTime + 1.2)
  out.connect(a.music)

  const prev = current
  current = { name, track, out, step: 0, nextTime: a.ctx.currentTime + 0.1 }
  if (prev) {
    prev.out.gain.cancelScheduledValues(a.ctx.currentTime)
    prev.out.gain.setValueAtTime(prev.out.gain.value || 1, a.ctx.currentTime)
    prev.out.gain.exponentialRampToValueAtTime(0.0001, a.ctx.currentTime + 1)
    setTimeout(() => prev.out.disconnect(), 1300)
  }
}

function schedule() {
  const a = getAudio()
  if (!a || !current || a.ctx.state !== 'running') return
  const { track, out } = current
  const stepDur = 60 / track.bpm / 4
  while (current.nextTime < a.ctx.currentTime + 0.12) {
    const t = current.nextTime
    const step = current.step % 16
    const bar = Math.floor(current.step / 16) % track.chords.length
    const chord = track.chords[bar]

    if (step === 0) {
      for (const n of chord) voice(a, out, { freq: NOTE(n), type: 'triangle', t, dur: stepDur * 15, vol: 0.035 })
    }
    if (track.bass.includes(step)) {
      voice(a, out, { freq: NOTE(chord[0] - 24), type: 'square', t, dur: stepDur * 1.6, vol: 0.07 })
    }
    const arpNote = chord[track.arp[step] % chord.length] + track.arpOctave
    voice(a, out, { freq: NOTE(arpNote), type: track.lead, t, dur: stepDur * 0.9, vol: 0.025, detune: track.lead === 'triangle' ? 8 : 0 })
    if (track.kick.includes(step)) drum(a, out, 'kick', t)
    if (track.snare.includes(step)) drum(a, out, 'snare', t)
    if (step % track.hat === 0) drum(a, out, 'hat', t)

    current.nextTime += stepDur
    current.step += 1
  }
}

export function playMusic(name) {
  wanted = name
  onAudioReady(() => {
    if (!timer) timer = setInterval(schedule, 25)
    if (!current || current.name !== wanted) startTrack(wanted)
  })
}
