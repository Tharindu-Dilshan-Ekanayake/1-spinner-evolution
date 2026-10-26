import { live } from '../store/live'

/**
 * Keyboard -> live.input (WASD/arrows, Space, Shift), written into the shared
 * live object so the frame loop and the touch controls share one input state.
 */
const KEY_MAP = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'jump',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
}

/** Typing in a text field must not walk the character. */
function typing(e) {
  const t = e.target
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
}

export function installKeyboard() {
  const onKeyDown = (e) => {
    if (typing(e)) return
    const action = KEY_MAP[e.code]
    if (!action) return
    e.preventDefault() // stop Space/arrows scrolling the page
    live.input[action] = true
  }
  const onKeyUp = (e) => {
    const action = KEY_MAP[e.code]
    if (action) live.input[action] = false
  }
  // Alt-tabbing away mid-run otherwise leaves a key stuck down.
  const onBlur = () => {
    for (const action of Object.values(KEY_MAP)) live.input[action] = false
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  return () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', onBlur)
  }
}
