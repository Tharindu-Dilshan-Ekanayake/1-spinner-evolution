import { useCallback, useEffect, useRef, useState } from 'react'

import { useBloxity } from './bloxity/BloxityContext'
import GameScene from './game/GameScene'
import { startTriggers } from './game/triggers'
import { connect, lastSessionWasUser, watchIdentity } from './net/connection'
import { useGameStore } from './store/gameStore'
import Hud from './ui/Hud'
import LoadingScreen from './ui/LoadingScreen'
import TouchControls from './ui/TouchControls'
import WorldOverlay from './ui/WorldOverlay'

/** How long to wait for the Bloxity SDK (to learn who's playing) before joining anyway. */
const IDENTITY_TIMEOUT_MS = 4000
/**
 * Once the base avatar is on screen, how long its cosmetics (skin, hat, parts) get to
 * arrive before the loading screen lifts anyway. They pop in when they land.
 */
const COSMETICS_GRACE_MS = 300
/** Delay after the loading screen lifts before secondary scenery is built. */
const SETTLE_MS = 1200

function App() {
  const { status, game } = useBloxity()
  const [avatarReady, setAvatarReady] = useState(false)
  const [firstFrame, setFirstFrame] = useState(false)
  const [avatarGrace, setAvatarGrace] = useState(false)
  const [zoneReady, setZoneReady] = useState(false)
  const started = useRef(false)

  // Guests join at once. A returning signed-in player waits for the SDK (up to a few
  // seconds) so their own save loads; if they turn out to have logged out, or log in
  // later, watchIdentity() switches saves.
  useEffect(() => {
    if (started.current) return undefined
    const start = () => {
      if (started.current) return
      started.current = true
      connect()
    }
    if (!lastSessionWasUser() || status === 'ready' || status === 'error') start()
    const timer = setTimeout(start, IDENTITY_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [status])

  useEffect(() => {
    const stopTriggers = startTriggers()
    const stopIdentity = watchIdentity()
    return () => {
      stopTriggers()
      stopIdentity()
    }
  }, [])

  useEffect(() => {
    game.loadingStep('Preparing scene…')
  }, [game])

  // `loadingEnd()` should mean "the player can see the game", not "React mounted".
  const ready = firstFrame && zoneReady && (avatarReady || avatarGrace)
  useEffect(() => {
    if (!ready) return
    performance.mark('app:playable')
    useGameStore.setState({ playable: true })
    // Let the loading screen fade out before building secondary scenery.
    const timer = setTimeout(() => useGameStore.setState({ settled: true }), SETTLE_MS)
    game.loadingEnd()
    return () => clearTimeout(timer)
  }, [ready, game])

  const onAvatarReady = useCallback(() => {
    performance.mark('app:avatar-ready')
    setAvatarReady(true)
  }, [])
  const onAvatarMounted = useCallback(() => {
    performance.mark('app:avatar-mounted')
    setTimeout(() => setAvatarGrace(true), COSMETICS_GRACE_MS)
  }, [])
  const onZoneReady = useCallback(() => {
    performance.mark('app:zone-ready')
    setZoneReady(true)
  }, [])
  const onFirstFrame = useCallback(() => {
    performance.mark('app:first-frame')
    setFirstFrame(true)
  }, [])

  return (
    <div className="relative w-screen select-none overflow-hidden bg-sky-400 game-font" style={{ height: '100dvh' }}>
      <GameScene onFirstFrame={onFirstFrame} onAvatarReady={onAvatarReady} onAvatarMounted={onAvatarMounted} onZoneReady={onZoneReady} />
      <WorldOverlay />
      <Hud />
      <TouchControls />
      <LoadingScreen sceneReady={ready} />
    </div>
  )
}

export default App
