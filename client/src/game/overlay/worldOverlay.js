import { Vector3 } from 'three'

/**
 * HTML labels pinned to world positions: HP bars with numbers, name tags, speech
 * bubbles and floating "+12" popups.
 *
 * DOM text is crisp at any resolution and costs no draw calls. Every element comes
 * from a fixed pool created once; each frame, systems request labels and flush()
 * positions them (writing styles only when something actually changed) and hides
 * whatever wasn't requested.
 */

const _v = new Vector3()

let root = null
let width = 1
let height = 1

function makePool(n, className, build, anchor = 'translate(-50%, -100%)') {
  const items = []
  for (let i = 0; i < n; i += 1) {
    const el = document.createElement('div')
    el.className = className
    el.style.display = 'none'
    const parts = build ? build(el) : {}
    items.push({ el, parts, anchor, used: false, shown: false, sx: -1, sy: -1, key: '', sub: '', fill: -1, visible: false, start: 0, wx: 0, wy: 0, wz: 0 })
  }
  return { items, next: 0 }
}

const pools = {}
/** The pools that are reset every frame (popups manage their own lifetime). */
let framePools = []

function buildHp(el) {
  el.innerHTML = '<span class="wl-icon"></span><div class="wl-bar"><div class="wl-fill"></div><span class="wl-num"></span></div>'
  return { icon: el.firstChild, fill: el.querySelector('.wl-fill'), num: el.querySelector('.wl-num') }
}

export function mountOverlay(container) {
  root = container
  pools.hp = makePool(48, 'wl wl-hp', buildHp)
  pools.name = makePool(18, 'wl wl-name')
  pools.bubble = makePool(4, 'wl wl-bubble')
  pools.popup = makePool(48, 'wl wl-pop', null, 'translate(-50%, -50%)')
  framePools = [pools.hp, pools.name, pools.bubble]
  for (const pool of Object.values(pools)) for (const it of pool.items) root.appendChild(it.el)
}

export function unmountOverlay() {
  if (root) root.innerHTML = ''
  root = null
  framePools = []
  for (const k of Object.keys(pools)) delete pools[k]
}

export function setOverlaySize(w, h) {
  width = w
  height = h
}

function take(pool) {
  if (!root || pool.next >= pool.items.length) return null
  const it = pool.items[pool.next]
  pool.next += 1
  it.used = true
  return it
}

/** Projects to screen; returns false when behind the camera. */
function project(camera, x, y, z) {
  _v.set(x, y, z).project(camera)
  if (_v.z > 1 || _v.z < -1) return false
  return true
}

function place(it, sx, sy) {
  const rx = Math.round(sx)
  const ry = Math.round(sy)
  if (rx !== it.sx || ry !== it.sy) {
    it.sx = rx
    it.sy = ry
    it.el.style.transform = `translate3d(${rx}px, ${ry}px, 0) ${it.anchor}`
  }
  if (!it.shown) {
    it.shown = true
    it.el.style.display = ''
  }
}

/* ---------------------------------------------------------------------------
 * Requests (call between begin and flush, inside the frame loop)
 * ------------------------------------------------------------------------- */

export const overlay = {
  begin() {
    for (let p = 0; p < framePools.length; p += 1) {
      const pool = framePools[p]
      pool.next = 0
      for (let i = 0; i < pool.items.length; i += 1) pool.items[i].used = false
    }
  },

  /** side: 0 = ours (green), 1 = enemy (orange/red). icon: '' | 'skull' | 'crown' */
  hp(camera, x, y, z, hp, maxHp, side, icon, numText) {
    if (!project(camera, x, y, z)) return
    const it = take(pools.hp)
    if (!it) return
    place(it, (_v.x * 0.5 + 0.5) * width, (-_v.y * 0.5 + 0.5) * height)
    const fill = Math.max(0, Math.min(1, hp / maxHp))
    const f = Math.round(fill * 100)
    if (f !== it.fill) {
      it.fill = f
      it.parts.fill.style.width = `${f}%`
      it.parts.fill.className = side === 0 ? 'wl-fill' : fill > 0.5 ? 'wl-fill wl-enemy' : 'wl-fill wl-enemy-low'
    }
    if (numText !== it.key || icon !== it.sub) {
      it.key = numText
      it.sub = icon
      it.parts.num.textContent = numText
      it.parts.icon.className = icon ? `wl-icon wl-${icon}` : 'wl-icon'
    }
  },

  name(camera, x, y, z, text, sub) {
    if (!project(camera, x, y, z)) return
    const it = take(pools.name)
    if (!it) return
    place(it, (_v.x * 0.5 + 0.5) * width, (-_v.y * 0.5 + 0.5) * height)
    if (text !== it.key || sub !== it.sub) {
      it.key = text
      it.sub = sub
      it.el.innerHTML = ''
      const n = document.createElement('div')
      n.textContent = text
      it.el.appendChild(n)
      if (sub) {
        const s = document.createElement('div')
        s.className = 'wl-sub'
        s.textContent = sub
        it.el.appendChild(s)
      }
    }
  },

  bubble(camera, x, y, z, text) {
    if (!project(camera, x, y, z)) return
    const it = take(pools.bubble)
    if (!it) return
    place(it, (_v.x * 0.5 + 0.5) * width, (-_v.y * 0.5 + 0.5) * height)
    if (text !== it.key) {
      it.key = text
      it.el.textContent = text
    }
  },

  flush(camera, now) {
    for (let p = 0; p < framePools.length; p += 1) {
      const pool = framePools[p]
      for (let i = 0; i < pool.items.length; i += 1) {
        const it = pool.items[i]
        if (!it.used && it.shown) {
          it.shown = false
          it.el.style.display = 'none'
        }
      }
    }
    updatePopups(camera, now)
  },
}

/* ---------------------------------------------------------------------------
 * Popups: "+12" numbers that rise and fade
 * ------------------------------------------------------------------------- */

const POPUP_MS = 900

/** kind: 'power' | 'dmg' | 'hurt' | 'wins' | 'candy' | 'crit' */
export function popup(x, y, z, text, kind = 'power') {
  const pool = pools.popup
  if (!pool) return
  let it = null
  let oldest = Infinity
  for (const p of pool.items) {
    if (!p.visible) {
      it = p
      break
    }
    if (p.start < oldest) {
      oldest = p.start
      it = p
    }
  }
  it.visible = true
  it.start = performance.now()
  it.wx = x + (Math.random() - 0.5) * 0.8
  it.wy = y
  it.wz = z + (Math.random() - 0.5) * 0.8
  it.el.className = `wl wl-pop wl-pop-${kind}`
  it.el.textContent = text
  it.sx = -1
}

function updatePopups(camera, now) {
  const pool = pools.popup
  if (!pool) return
  for (let i = 0; i < pool.items.length; i += 1) {
    const it = pool.items[i]
    if (!it.visible) continue
    const k = (now - it.start) / POPUP_MS
    if (k >= 1) {
      it.visible = false
      it.shown = false
      it.el.style.display = 'none'
      continue
    }
    if (!project(camera, it.wx, it.wy + k * 1.6, it.wz)) continue
    place(it, (_v.x * 0.5 + 0.5) * width, (-_v.y * 0.5 + 0.5) * height)
    it.el.style.opacity = k < 0.7 ? '1' : String(1 - (k - 0.7) / 0.3)
  }
}
