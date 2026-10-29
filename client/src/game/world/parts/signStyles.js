import { FONT, drawText, fitSize, roundRect } from '../../render/signAtlas'

/**
 * Signs are drawn on canvases, so the game font must be loaded first or the first
 * frame bakes the fallback font into the atlas. Suspends until it is.
 */
export const fontsReady =
  typeof document !== 'undefined' && document.fonts
    ? document.fonts.load(`64px ${FONT.split(',')[0]}`).catch(() => null)
    : Promise.resolve()

/* ---------------------------------------------------------------------------
 * Sign styles
 * ------------------------------------------------------------------------- */

/** Big outlined banner text on a transparent background ("TRAIN POWER"). */
export function bannerText(text, fill = ['#fff36b', '#ffb300'], stroke = '#3a1e00') {
  return (ctx, w, h) => {
    const size = fitSize(ctx, text, h * 0.78, w * 0.94)
    drawText(ctx, text, w / 2, h / 2, size, fill, stroke)
  }
}

/** Dark translucent panel with a title and a subtitle ("Rare Capsule / 200 Wins"). */
export function labelPanel(title, sub, { titleFill = '#ffffff', subFill = '#ffe14d', panel = 'rgba(16, 20, 40, 0.55)' } = {}) {
  return (ctx, w, h) => {
    roundRect(ctx, 2, 2, w - 4, h - 4, h * 0.12)
    ctx.fillStyle = panel
    ctx.fill()
    const ts = fitSize(ctx, title, h * (sub ? 0.42 : 0.62), w * 0.92)
    drawText(ctx, title, w / 2, sub ? h * 0.34 : h / 2, ts, titleFill)
    if (sub) {
      const ss = fitSize(ctx, sub, h * 0.3, w * 0.9)
      drawText(ctx, sub, w / 2, h * 0.74, ss, subFill)
    }
  }
}

/** Solid framed board (gate signs, the WINS SHOP board). */
export function boardSign(lines, { bg = '#e8243a', border = '#ffd400' } = {}) {
  return (ctx, w, h) => {
    roundRect(ctx, 0, 0, w, h, h * 0.08)
    ctx.fillStyle = border
    ctx.fill()
    roundRect(ctx, h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1, h * 0.06)
    ctx.fillStyle = bg
    ctx.fill()
    const total = lines.reduce((s, l) => s + l.size, 0)
    let y = h * 0.5 - (total * h) / 2
    for (const l of lines) {
      const px = l.size * h
      const size = fitSize(ctx, l.text, px * 0.9, w * 0.9)
      drawText(ctx, l.text, w / 2, y + px / 2, size, l.fill || '#ffffff', l.stroke || '#1b1b2a')
      y += px
    }
  }
}

/** A heart, centred on (cx, cy), `s` wide. */
function heartPath(ctx, cx, cy, s) {
  const r = s / 2
  ctx.beginPath()
  ctx.moveTo(cx, cy + r * 0.9)
  ctx.bezierCurveTo(cx - r * 1.3, cy + r * 0.1, cx - r * 0.95, cy - r * 1.05, cx, cy - r * 0.45)
  ctx.bezierCurveTo(cx + r * 0.95, cy - r * 1.05, cx + r * 1.3, cy + r * 0.1, cx, cy + r * 0.9)
  ctx.closePath()
}

/** Outlined text with a soft drop under it, like the HUD's StrokeText. */
function strokeText(ctx, text, x, y, size, fill, stroke = '#141428') {
  // No save()/restore() here: it would reset the font behind the size cache's back.
  const alpha = ctx.globalAlpha
  ctx.globalAlpha = alpha * 0.35
  drawText(ctx, text, x, y + size * 0.08, size, '#000000', '#000000')
  ctx.globalAlpha = alpha
  drawText(ctx, text, x, y, size, fill, stroke)
}

/**
 * A stage gate's board, in the HUD's chunky style: a gold frame round a deep blue
 * face, the instruction on a dark pill at the top, the stage number big in gold, and
 * the enemy army's HP on a red pill with a heart.
 */
export function gateBoard({ note, title, hp }) {
  const face = ['#3e5ff0', '#1d2b8f']
  return (ctx, w, h) => {
    const r = h * 0.1
    // Gold frame with a darker lip, then the gradient face and a thin white line.
    roundRect(ctx, 0, h * 0.02, w, h * 0.98, r)
    ctx.fillStyle = '#b86e00'
    ctx.fill()
    roundRect(ctx, 0, 0, w, h * 0.96, r)
    let g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#fff27a')
    g.addColorStop(0.5, '#ffcb1f')
    g.addColorStop(1, '#ff9a0a')
    ctx.fillStyle = g
    ctx.fill()
    const inset = h * 0.055
    roundRect(ctx, inset, inset, w - inset * 2, h * 0.96 - inset * 2, r * 0.75)
    g = ctx.createLinearGradient(0, inset, 0, h - inset)
    g.addColorStop(0, face[0])
    g.addColorStop(1, face[1])
    ctx.fillStyle = g
    ctx.fill()
    ctx.lineWidth = Math.max(2, h * 0.012)
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    roundRect(ctx, inset * 1.6, inset * 1.6, w - inset * 3.2, h * 0.96 - inset * 3.2, r * 0.55)
    ctx.stroke()
    // Gloss over the top half of the face.
    roundRect(ctx, inset * 1.6, inset * 1.6, w - inset * 3.2, h * 0.36, r * 0.55)
    g = ctx.createLinearGradient(0, inset, 0, h * 0.4)
    g.addColorStop(0, 'rgba(255,255,255,0.22)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fill()

    // The instruction, on a dark pill.
    const noteSize = fitSize(ctx, note, h * 0.085, w * 0.7)
    setPillText(ctx, note, w / 2, h * 0.17, noteSize, 'rgba(10,14,40,0.55)', '#bfe6ff')

    // STAGE N, big and gold.
    const titleSize = fitSize(ctx, title, h * 0.3, w * 0.86)
    strokeText(ctx, title, w / 2, h * 0.45, titleSize, ['#ffffff', '#fff3a0', '#ffc21a'])

    // The HP on a red pill with a heart.
    const hpSize = fitSize(ctx, hp, h * 0.15, w * 0.5)
    fitSize(ctx, hp, hpSize, Infinity)
    const textW = ctx.measureText(hp).width
    const pillH = hpSize * 1.45
    const pillW = textW + hpSize * 2.6
    const px = w / 2 - pillW / 2
    const py = h * 0.74 - pillH / 2
    roundRect(ctx, px, py + pillH * 0.08, pillW, pillH, pillH / 2)
    ctx.fillStyle = '#7e0f1c'
    ctx.fill()
    roundRect(ctx, px, py, pillW, pillH, pillH / 2)
    g = ctx.createLinearGradient(0, py, 0, py + pillH)
    g.addColorStop(0, '#ff8a7a')
    g.addColorStop(0.5, '#ff3b3b')
    g.addColorStop(1, '#d4142a')
    ctx.fillStyle = g
    ctx.fill()
    ctx.lineWidth = Math.max(3, h * 0.018)
    ctx.strokeStyle = '#141428'
    ctx.stroke()
    const hx = px + pillH * 0.62
    const hy = py + pillH / 2
    heartPath(ctx, hx, hy, pillH * 0.62)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.lineWidth = Math.max(2, h * 0.012)
    ctx.stroke()
    strokeText(ctx, hp, px + pillH * 1.1 + textW / 2, hy, hpSize, '#ffffff')
  }
}

/** Small text centred on a rounded dark pill. */
function setPillText(ctx, text, x, y, size, bg, fill) {
  fitSize(ctx, text, size, Infinity)
  const tw = ctx.measureText(text).width
  const ph = size * 1.55
  const pw = tw + size * 1.6
  roundRect(ctx, x - pw / 2, y - ph / 2, pw, ph, ph / 2)
  ctx.fillStyle = bg
  ctx.fill()
  drawText(ctx, text, x, y, size, fill, '#0a0e28')
}
