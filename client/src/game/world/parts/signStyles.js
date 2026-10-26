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
