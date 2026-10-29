import { SHOP_ITEMS, SHOP_PAD, SHOP_PADS, STAGE, TRAIN_PAD, playerPad, returnPad, trainPad } from '@shared'

/**
 * The first-time tutorial's guide arrows: where a brand-new player should walk next.
 *
 *   1. TRAIN HERE      - the Beginner ring's training pad, until Level 2
 *   2. BATTLE HERE     - Stage 1's blue pad, until Stage 1 has been beaten once
 *   3. BANK YOUR WINS  - the Return pad, which takes the wins home to the lobby
 *   4. BUY A SPINNER   - the Basic Spinner's pad in the Spinners Shop: spend those wins
 *      (not enough wins yet? back to BATTLE FOR WINS)
 *
 * The battle comes first even if a gift already gave enough wins: the lesson is that
 * wins come from the stages. Buying a spinner after beating Stage 1 sets
 * profile.tutorialDone on the server and the arrows never show again. Players who already knew the game (older saves) never see them at all.
 *
 * @returns {{ x, z, y, label, ring?, reach? } | null} the spot to walk to, and how close
 *   counts as arrived (the arrows hide)
 */
export function tutorialTarget({ profile, zone, run }) {
  if (!profile || profile.tutorialDone !== false || zone !== 'lobby') return null
  if (run && run.world === 'grassland' && run.cleared >= 1) {
    const rp = returnPad(run.cleared)
    return { x: rp.x, z: rp.z, y: STAGE.returnPadTop, label: 'BANK YOUR WINS' }
  }
  if (profile.level < 2) return { ...trainPad('beginner'), y: TRAIN_PAD.top, ring: 'beginner', label: 'TRAIN HERE' }
  const pad = playerPad(1)
  const beaten = (profile.best?.grassland || 0) >= 1
  if (!beaten) return { x: pad.x, z: pad.z, y: STAGE.padTop, label: 'BATTLE HERE' }
  if (profile.wins >= SHOP_ITEMS.basic.cost) {
    const c = SHOP_PADS.find((pad) => pad.id === 'basic')
    // At the pad its own "[E] Buy" prompt takes over (see triggers.js).
    return { x: c.x, z: c.z, y: 2, reach: SHOP_PAD.reach, label: 'BUY A SPINNER' }
  }
  // Spinners cost wins: not enough yet, so back to the stages for more.
  return { x: pad.x, z: pad.z, y: STAGE.padTop, label: 'BATTLE FOR WINS' }
}

/** True while the player is still in the first-time tutorial. */
export const inTutorial = (profile) => Boolean(profile) && profile.tutorialDone === false
