import {
  AmbientLight,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  WebGLRenderTarget,
} from 'three'

import { SPINNERS, WORLDS } from '@shared'

import { useGameStore } from '../../store/gameStore'
import { familyGeometry } from './spinnerGeometry'

/**
 * Spinner pictures for the UI (inventory grid, capsule odds, reveal cards).
 *
 * Each picture is rendered ONCE with the game's own renderer into a small render
 * target, read back into a PNG data URL and cached for the session - no image files,
 * no second WebGL context. Generation runs on a timer outside the frame loop, a few
 * icons per tick, and bumps `iconVersion` so React re-reads the cache.
 */

const SIZE = 128
const cache = new Map()
const queue = []
const queued = new Set()
let renderer = null
let timer = null

let scene = null
let camera = null
let target = null
let material = null
let pixels = null
let canvas = null

export function setIconRenderer(gl) {
  renderer = gl
  // A new context (after a context loss) can't use the old render target.
  target?.dispose()
  target = null
  if (queue.length) schedule()
}

function setup() {
  if (scene) return
  scene = new Scene()
  scene.add(new AmbientLight('#ffffff', 1.4))
  const key = new DirectionalLight('#ffffff', 2.4)
  key.position.set(2, 4, 3)
  scene.add(key)
  camera = new PerspectiveCamera(32, 1, 0.1, 20)
  camera.position.set(0, 3.1, 3.6)
  camera.lookAt(0, 0.3, 0)
  material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.15 })
  pixels = new Uint8Array(SIZE * SIZE * 4)
  canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
}

/** Colours the family geometry by part (same scheme as the instanced shader). */
function coloredGeometry(family, a, b, golden) {
  const base = familyGeometry(family)
  const g = base.clone()
  const parts = g.getAttribute('aPart')
  const colors = new Float32Array(parts.count * 3)
  const ca = new Color(a)
  const cb = new Color(b)
  const metal = new Color(0.78, 0.8, 0.86)
  const gold = new Color(1, 0.72, 0.15)
  for (let i = 0; i < parts.count; i += 1) {
    const p = parts.getX(i)
    const c = (p < 0.5 ? ca : p < 1.5 ? cb : metal).clone()
    if (golden) c.lerp(gold, 0.65)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return g
}

function renderIcon(key) {
  const [kind, id, flag] = key.split(':')
  let family
  let a
  let b
  if (kind === 'enemy') {
    const w = WORLDS[id] || WORLDS.grassland
    family = 'saw'
    a = w.enemy.a
    b = w.enemy.b
  } else {
    const def = SPINNERS[id]
    if (!def) return null
    family = def.family
    a = def.a
    b = def.b
  }

  if (!target) {
    target = new WebGLRenderTarget(SIZE, SIZE)
    target.texture.colorSpace = SRGBColorSpace
  }
  const geometry = coloredGeometry(family, a, b, flag === 'g')
  const mesh = new Mesh(geometry, material)
  mesh.rotation.set(0.25, 0.6, 0)
  scene.add(mesh)

  const prevTarget = renderer.getRenderTarget()
  const prevClear = renderer.getClearColor(new Color())
  const prevAlpha = renderer.getClearAlpha()
  renderer.setRenderTarget(target)
  renderer.setClearColor(0x000000, 0)
  renderer.clear()
  renderer.render(scene, camera)
  renderer.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, pixels)
  renderer.setRenderTarget(prevTarget)
  renderer.setClearColor(prevClear, prevAlpha)

  scene.remove(mesh)
  geometry.dispose()

  // GL rows start at the bottom; canvas rows at the top.
  const ctx = canvas.getContext('2d')
  const image = ctx.createImageData(SIZE, SIZE)
  for (let y = 0; y < SIZE; y += 1) {
    const src = (SIZE - 1 - y) * SIZE * 4
    image.data.set(pixels.subarray(src, src + SIZE * 4), y * SIZE * 4)
  }
  ctx.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}

function schedule() {
  if (timer || !renderer) return
  timer = setTimeout(() => {
    timer = null
    if (!renderer) return
    setup()
    let made = 0
    while (queue.length && made < 6) {
      const key = queue.shift()
      queued.delete(key)
      try {
        cache.set(key, renderIcon(key))
      } catch (err) {
        console.warn('[icons] failed', key, err)
        cache.set(key, null)
      }
      made += 1
    }
    if (made) useGameStore.setState((s) => ({ iconVersion: s.iconVersion + 1 }))
    if (queue.length) schedule()
  }, 16)
}

/**
 * Data URL for a spinner picture, or null while it's being made (the caller
 * re-renders when `iconVersion` changes).
 */
export function spinnerIcon(id, golden = false) {
  const key = `s:${id}:${golden ? 'g' : ''}`
  if (cache.has(key)) return cache.get(key)
  if (!queued.has(key)) {
    queued.add(key)
    queue.push(key)
    schedule()
  }
  return null
}
