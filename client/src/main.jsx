import '@fontsource/lilita-one/latin-400.css'

// Startup milestones, read by scripts/perf-probe.mjs (cheap; harmless in production).
performance.mark('app:js-start')

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.jsx'
import { unlockAudioOnFirstGesture } from './audio/audio'
import BloxityProvider from './bloxity/BloxityProvider.jsx'
import { installKeyboard } from './game/input'
import { connect, lastSessionWasUser } from './net/connection'
import './index.css'

// Browsers only allow sound after a tap/click/key; the context is created then.
unlockAudioOnFirstGesture()
installKeyboard()

// Guests (most first visits) join the server right away, so the matchmaking round
// trips overlap with building the scene. Signed-in players join from App once the
// Bloxity SDK says who they are.
if (!lastSessionWasUser()) connect()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Slug comes from VITE_GAME_SLUG in client/.env — see .env.example. */}
    <BloxityProvider gameSlug={import.meta.env.VITE_GAME_SLUG}>
      <App />
    </BloxityProvider>
  </StrictMode>,
)
