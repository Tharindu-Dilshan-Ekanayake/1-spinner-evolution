/**
 * Keeps the game server up: runs src/index.js and starts it again whenever it exits
 * unexpectedly (out of memory, a native crash - anything the in-process guards can't
 * catch). Saves are flushed on every exit, so a restart loses nothing.
 *
 *   npm run start:safe
 *
 * A clean shutdown (Ctrl+C / SIGTERM) stops the supervisor too. A server that keeps
 * dying straight after starting is restarted with a growing back-off, not in a loop.
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ENTRY = fileURLToPath(new URL('../src/index.js', import.meta.url))
const MIN_DELAY_MS = 1000
const MAX_DELAY_MS = 30000
/** A server that stayed up this long counts as healthy; the back-off resets. */
const HEALTHY_AFTER_MS = 60000

let child = null
let stopping = false
let delay = MIN_DELAY_MS

function start() {
  const startedAt = Date.now()
  child = spawn(process.execPath, [ENTRY], { stdio: 'inherit', env: process.env })
  child.on('exit', (code, signal) => {
    child = null
    if (stopping) return
    if (Date.now() - startedAt > HEALTHY_AFTER_MS) delay = MIN_DELAY_MS
    console.error(`[supervise] server exited (code ${code}, signal ${signal}); restarting in ${delay} ms`)
    setTimeout(start, delay)
    delay = Math.min(MAX_DELAY_MS, delay * 2)
  })
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopping = true
    if (child) child.kill(signal)
    else process.exit(0)
    setTimeout(() => process.exit(0), 5000).unref()
  })
}

start()
