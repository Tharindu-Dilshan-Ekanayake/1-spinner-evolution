import { defineRoom, defineServer } from '@colyseus/core'

import { startLeaderboardReports } from './bloxity.js'
import { initStore, saveNow, startAutosave } from './game/store.js'
import { installRoomReporter } from './legion-room-reporter.js'
import { registerHttpRoutes } from './http.js'
import { WorldRoom } from './rooms/WorldRoom.js'

const PORT = Number(process.env.PORT || 3000)

await initStore()
startAutosave()
startLeaderboardReports()

const server = defineServer({
  rooms: {
    world: defineRoom(WorldRoom),
  },
  express: registerHttpRoutes,
  greet: false,
  // We shut down ourselves (below): Colyseus's own handler would race with ours.
  gracefullyShutdown: false,
})

await server.listen(PORT)
// Lists the live rooms on Boxity's game page ("Open Rooms"); a no-op outside Boxity hosting.
installRoomReporter()
console.log(`Server listening on http://localhost:${PORT} (Colyseus room "world")`)

// Never die on one stray error: log it, make sure the saves are on disk, keep serving.
// (A real crash - out of memory, say - is caught by scripts/supervise.js, which
// restarts the server; see "npm run start:safe".)
process.on('uncaughtException', (err) => {
  console.error('[server] uncaught exception', err)
  saveNow().catch((saveErr) => console.error('[server] save after exception failed', saveErr))
})
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled promise rejection', reason)
})

// Stopping (a deploy, a scale-down, Ctrl+C): let every room disconnect its players first
// (that banks stage runs and saves each player, and the clients rejoin through the
// matchmaker on another server), then write what is left and exit.
let stopping = false
async function shutDown(signal) {
  if (stopping) return
  stopping = true
  console.log(`[server] ${signal}: saving and shutting down`)
  const failsafe = setTimeout(() => process.exit(1), 25000)
  failsafe.unref?.()
  try {
    await server.gracefullyShutdown(false)
  } catch (err) {
    console.error('[server] rooms did not close cleanly', err)
  }
  try {
    await saveNow()
  } catch (err) {
    console.error('[server] final save failed', err)
  }
  process.exit(0)
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => shutDown(signal))
