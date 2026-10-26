import { defineRoom, defineServer } from '@colyseus/core'

import { loadStore, saveNow, startAutosave } from './game/store.js'
import { registerHttpRoutes } from './http.js'
import { WorldRoom } from './rooms/WorldRoom.js'

const PORT = Number(process.env.PORT || 3000)

loadStore()
startAutosave()

const server = defineServer({
  rooms: {
    world: defineRoom(WorldRoom),
  },
  express: registerHttpRoutes,
  greet: false,
})

await server.listen(PORT)
console.log(`Server listening on http://localhost:${PORT} (Colyseus room "world")`)

// Flush saves on the way out, whatever stops the process.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    try {
      saveNow()
    } finally {
      process.exit(0)
    }
  })
}
