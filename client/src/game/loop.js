import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef } from 'react'

/**
 * One frame loop for the whole game, with an explicit order.
 *
 * Several systems write into shared per-frame batches (the instanced spinner renderer
 * is filled by pets, battle units, dummies...), so "who runs first" matters. Instead
 * of relying on useFrame mount order, systems register here with an order key and a
 * single <GameLoop /> calls them in that order every frame.
 */

export const ORDER = {
  input: 0,
  player: 10,
  camera: 20,
  remotes: 30,
  /** Instanced batches are cleared here... */
  batchBegin: 35,
  pets: 40,
  battle: 50,
  world: 55,
  fx: 60,
  /** ...and uploaded here. */
  batchEnd: 80,
  labels: 90,
}

const systems = []

export function addSystem(order, fn) {
  const entry = { order, fn }
  let i = systems.length
  while (i > 0 && systems[i - 1].order > order) i -= 1
  systems.splice(i, 0, entry)
  return () => {
    const at = systems.indexOf(entry)
    if (at >= 0) systems.splice(at, 1)
  }
}

/**
 * Registers `fn(dt, state)` for the lifetime of the component. The latest `fn` is
 * always called, so it can close over props without re-registering.
 */
export function useSystem(order, fn) {
  const ref = useRef(fn)
  // Refresh after each render (not during it), before the next frame can run.
  useLayoutEffect(() => {
    ref.current = fn
  })
  useEffect(() => addSystem(order, (dt, state) => ref.current(dt, state)), [order])
}

export function GameLoop() {
  useFrame((state, delta) => {
    // Clamp: a backgrounded tab returns with a huge delta.
    const dt = Math.min(delta, 0.1)
    for (let i = 0; i < systems.length; i += 1) systems[i].fn(dt, state)
  })
  return null
}
