import { BOXITY_BOARDS, C2S } from '@shared'

import { setAudioPaused, setVolume } from '../audio/audio'
import { playEmote, send } from '../net/connection'
import { useGameStore } from '../store/gameStore'
import { live } from '../store/live'
import { useQualityStore } from '../store/qualityStore'
import { SELF, showBubble } from './chatBubbles'
import { loadEmotes } from './emotes'
import { safeCall, toUnsubscribe } from './sdk'

/**
 * Everything the game does with the Boxity platform beyond sign-in and avatars (those
 * live in BloxityProvider), wired once right after Legion.SDK.init():
 *
 *  - ad breaks: Boxity runs every ad itself; the game pauses and goes quiet meanwhile
 *  - screen ads: full-screen panels tell Boxity a 'panel' screen is showing
 *  - leaderboards: the boards are declared here (the server submits the scores)
 *  - emotes: Boxity draws the picker; we play what it sends and show it to the room
 *  - chat: Boxity draws the chat; each line shows above its speaker's head
 *  - settings: Boxity's menu controls for volume and graphics quality
 *  - player events: "Reset Character" from Boxity's menu
 *  - gameplay start/end around the time the player is actually in the world
 *
 * The game can't die (no death screen), sells nothing (no Gems), and has no rewards
 * earned by watching ads - see BLOXITY_CODE_METADATA.md.
 *
 * @returns {() => void} undoes all of it
 */
export function startPlatform(sdk) {
  const offs = []
  const on = (fn) => offs.push(toUnsubscribe(fn))

  // --- Ad breaks: may start at any time, asked for or not. ----------------------
  on(
    safeCall(sdk.ads?.onBreakStart?.bind(sdk.ads), () => {
      useGameStore.setState({ adBreak: true })
      live.input.jump = false
      setAudioPaused(true)
    }),
  )
  on(
    safeCall(sdk.ads?.onBreakEnd?.bind(sdk.ads), () => {
      useGameStore.setState({ adBreak: false })
      setAudioPaused(false)
    }),
  )

  // --- Screen ads around full-screen panels (banners sit along the edges). -------
  let screen = null
  on(
    useGameStore.subscribe((s, prev) => {
      if (Boolean(s.panel) === Boolean(prev.panel)) return
      if (s.panel) screen = safeCall(sdk.ads?.screen?.bind(sdk.ads), 'panel') || null
      else {
        safeCall(screen?.hide?.bind(screen))
        screen = null
      }
    }),
  )

  // --- Leaderboards: declared once (it is what shows Boxity's trophy button). ----
  safeCall(sdk.leaderboard?.define?.bind(sdk.leaderboard), BOXITY_BOARDS)

  // --- Emotes, from Boxity's own picker. -----------------------------------------
  safeCall(sdk.game?.registerFeature?.bind(sdk.game), 'emotes')
  loadEmotes()

  on(
    safeCall(sdk.player?.onEvent?.bind(sdk.player), (event, data) => {
      if (event === 'play_emote') playEmote(data)
      // Boxity menu's "Reset Character": back to the lobby spawn.
      else if (event === 'respawn_request' && !live.battle) send(C2S.teleport, { to: 'lobby' })
    }),
  )

  // --- Chat lines above heads (Boxity verified the sender and filtered the text). --
  on(
    safeCall(sdk.chat?.onMessage?.bind(sdk.chat), (m) => {
      const text = safeCall(sdk.chat.bubbleText?.bind(sdk.chat), m) || m?.text || ''
      showBubble(m?.isLocalPlayer ? SELF : String(m?.userId || '').replace(/^legion_/, ''), text, sdk.chat.bubbleSeconds || 4)
    }),
  )

  offs.push(...listenSettings(sdk))

  // --- Gameplay: from the moment the world is playable. ---------------------------
  const startGameplay = () => safeCall(sdk.game?.gameplayStart?.bind(sdk.game))
  if (useGameStore.getState().playable) startGameplay()
  else {
    on(
      useGameStore.subscribe((s, prev) => {
        if (s.playable && !prev.playable) startGameplay()
      }),
    )
  }
  const end = () => safeCall(sdk.game?.gameplayEnd?.bind(sdk.game))
  window.addEventListener('pagehide', end)
  offs.push(() => window.removeEventListener('pagehide', end))

  return () => offs.forEach((off) => safeCall(off))
}

/* ---------------------------------------------------------------------------
 * Settings (all values are strings). Registering a key also puts its control in
 * Boxity's menu. Each listener fires at once with the stored value: that first value
 * is applied only when it isn't Boxity's default, so a default can't override what
 * the player chose in the game's own Settings (or the phone's automatic LOW preset).
 * ------------------------------------------------------------------------- */

const QUALITY = { Low: 'LOW', Medium: 'MEDIUM', High: 'HIGH', Ultra: 'HIGH' }

function listenSettings(sdk) {
  const listen = sdk.settings?.listen?.bind(sdk.settings)
  if (!listen) return []
  const levels = { master: 0.8, music: 0.8 }
  const applyVolumes = () => {
    setVolume('sfx', levels.master)
    // The game's own music mix sits at ~0.56 of the effects (0.45 at the defaults).
    setVolume('music', levels.master * levels.music * 0.7)
  }
  const setting = (key, fallback, apply) => {
    let last = null
    return toUnsubscribe(
      safeCall(listen, key, (raw) => {
        const value = String(raw)
        // triggerAll() replays values: only a real change does anything.
        if (value === last) return
        const first = last === null
        last = value
        if (!(first && value === fallback)) apply(value)
      }),
    )
  }
  const offs = [
    setting('master_volume', '80', (v) => {
      levels.master = Math.min(1, Math.max(0, Number(v) / 100 || 0))
      applyVolumes()
    }),
    setting('music_volume', '80', (v) => {
      levels.music = Math.min(1, Math.max(0, Number(v) / 100 || 0))
      applyVolumes()
    }),
    setting('graphics_quality', 'High', (v) => {
      if (QUALITY[v]) useQualityStore.getState().choose(QUALITY[v])
    }),
  ]
  safeCall(sdk.settings.triggerAll?.bind(sdk.settings))
  return offs
}
