/**
 * The game's icon set, shared with the studio's +1 Slide Downhill: hand-drawn SVG in a
 * glossy cartoon style with thick dark outlines. Spinner Evolution adds its own icons
 * (spinner, aura, trail, gift, gear, lock, potions) at the end. Strings rather than components so the same art feeds
 * both the DOM HUD (<img src>) and the canvas-drawn 3D world labels.
 *
 * Every icon uses a 100x100 viewBox. Gradient ids are prefixed per icon so icons can
 * be inlined side by side without clashing.
 */

import rebirthImage from '../../assets/rebirth.webp'

const OUT = '#1b1b1f'

/** Icons that are artwork rather than drawn SVG, by name. */
const IMAGE_ICONS = {
  // The game's own rebirth art: pink and ice-blue chasing arrows (150 px, 5 KB).
  rebirth: rebirthImage,
}

const svg = (body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${defs}</defs>${body}</svg>`

const vgrad = (id, stops) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops
    .map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`)
    .join('')}</linearGradient>`

const GOLD = [
  [0, '#fff6a3'],
  [0.45, '#ffcf2e'],
  [1, '#f08c00'],
]

const trophy = svg(
  `<g stroke="${OUT}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">
    <path d="M27 24H11c0 19 9 28 22 30" fill="none" stroke-width="13"/>
    <path d="M73 24h16c0 19-9 28-22 30" fill="none" stroke-width="13"/>
  </g>
  <g fill="none" stroke="url(#tr-g)" stroke-width="5" stroke-linecap="round">
    <path d="M27 24H11c0 19 9 28 22 30"/><path d="M73 24h16c0 19-9 28-22 30"/>
  </g>
  <g stroke="${OUT}" stroke-width="5" stroke-linejoin="round" fill="url(#tr-g)">
    <path d="M42 62h16l3 15H39z"/>
    <rect x="27" y="76" width="46" height="15" rx="5"/>
    <path d="M22 12h56v22c0 19-12 30-28 30S22 53 22 34z"/>
  </g>
  <path d="M50 21l4.6 9.4 10.4 1.5-7.5 7.3 1.8 10.3L50 44.6l-9.3 4.9 1.8-10.3-7.5-7.3 10.4-1.5z" fill="#fffbd1" stroke="#d98900" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M30 18v16c0 8 3 14 8 18" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity=".75"/>`,
  vgrad('tr-g', GOLD),
)

const muscle = svg(
  `<path d="M14 88V64c0-20 22-30 38-14l4 3V34c-3-6-3-14 3-19 7-6 19-6 25 2 5 7 5 16-1 21l1 34c0 10-8 17-18 17z" fill="url(#mu-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M56 53c4 3 9 3 13-1" fill="none" stroke="${OUT}" stroke-width="5" stroke-linecap="round"/>
  <path d="M62 24c3-3 8-4 12-2" fill="none" stroke="${OUT}" stroke-width="4" stroke-linecap="round"/>
  <path d="M22 70c2-9 10-14 20-11" fill="none" stroke="#fff6c4" stroke-width="5" stroke-linecap="round" opacity=".85"/>
  <path d="M64 15c4-2 9-1 12 1" fill="none" stroke="#fff6c4" stroke-width="4" stroke-linecap="round" opacity=".85"/>`,
  vgrad('mu-g', [
    [0, '#ffd84a'],
    [0.6, '#ffa21c'],
    [1, '#f07a00'],
  ]),
)

/** A round potion flask with a cork, filled with `liquid` and a small badge icon. */
function potion(id, liquid, liquidDark, badge) {
  return svg(
    `<rect x="38" y="6" width="24" height="16" rx="4" fill="#c98a4b" stroke="${OUT}" stroke-width="5"/>
    <path d="M40 22h20v12c16 5 26 18 26 32 0 18-16 30-36 30S14 84 14 66c0-14 10-27 26-32z" fill="#e8f6ff" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M18 64c10-6 22 4 32 0s22-6 32 0c0 16-14 26-32 26S18 80 18 64z" fill="url(#${id}-l)"/>
    <path d="M24 56c2-8 8-14 16-16" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    ${badge}`,
    vgrad(`${id}-l`, [
      [0, liquid],
      [1, liquidDark],
    ]),
  )
}

const potionWins = potion(
  'pw',
  '#4fd2ff',
  '#1565e0',
  `<path d="M38 62h24v6c0 7-5 12-12 12s-12-5-12-12z" fill="#ffd23a" stroke="${OUT}" stroke-width="3.5" stroke-linejoin="round"/>
   <rect x="42" y="80" width="16" height="6" rx="2" fill="#ffd23a" stroke="${OUT}" stroke-width="3"/>`,
)
const check = svg(
  `<path d="M16 52l22 22 46-48" fill="none" stroke="${OUT}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M16 52l22 22 46-48" fill="none" stroke="#5cf064" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`,
)

const starGold = svg(
  `<path d="M50 6l13 27 29 4-21 20 5 29-26-14-26 14 5-29L8 37l29-4z" fill="url(#sg-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M38 30l7-13" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".75"/>`,
  vgrad('sg-g', GOLD),
)

const SPEAKER = `<path d="M14 38h16l22-18v60L30 62H14z" fill="url(#sp-g)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M20 44h8" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".7"/>`
const SPEAKER_GRADIENT = vgrad('sp-g', [
  [0, '#ffffff'],
  [1, '#c7d3e3'],
])

const sound = svg(
  `${SPEAKER}
  <path d="M62 38c6 7 6 17 0 24M72 30c11 11 11 29 0 40" fill="none" stroke="${OUT}" stroke-width="12" stroke-linecap="round"/>
  <path d="M62 38c6 7 6 17 0 24M72 30c11 11 11 29 0 40" fill="none" stroke="#7fe2ff" stroke-width="5" stroke-linecap="round"/>`,
  SPEAKER_GRADIENT,
)

const soundOff = svg(
  `${SPEAKER}
  <path d="M62 38l22 24M84 38L62 62" stroke="${OUT}" stroke-width="13" stroke-linecap="round"/>
  <path d="M62 38l22 24M84 38L62 62" stroke="#ff5a5a" stroke-width="6" stroke-linecap="round"/>`,
  SPEAKER_GRADIENT,
)

/* ---------------------------------------------------------------------------
 * Spinner Evolution's own icons, in the "sticker" look of the rebirth art: every
 * shape is drawn twice - a darker copy a few units lower for depth, then the face
 * with a top-lit gradient - both with the thick outline, plus a soft gloss on top.
 * ------------------------------------------------------------------------- */

/** Gloss that fades out halfway down whatever it fills. */
const gloss = (id) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>`

/** A shape as a sticker: depth copy, gradient face, gloss. Returns [body, defs]. */
function sticker(id, d, light, mid, dark, depth = 7) {
  return [
    `<path d="${d}" transform="translate(0 ${depth})" fill="${dark}" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
    <path d="${d}" fill="url(#${id}-f)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
    <path d="${d}" fill="url(#${id}-g)"/>`,
    vgrad(`${id}-f`, [
      [0, light],
      [1, mid],
    ]) + gloss(`${id}-g`),
  ]
}

const circlePath = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`

/** Polygon through `n` points alternating between two radii (stars, gears, saws). */
function starPath(cx, cy, n, rOut, rIn, sy = 1, turn = -Math.PI / 2) {
  const pts = []
  for (let i = 0; i < n * 2; i += 1) {
    const a = turn + (i / (n * 2)) * Math.PI * 2
    const r = i % 2 ? rIn : rOut
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r * sy).toFixed(1)}`)
  }
  return `M${pts.join('L')}Z`
}

/** A battle top in three-quarter view: steel tip, toothed red ring, blue dome, gold bolt. */
const spinner = (() => {
  const [face, defs] = sticker('sp', starPath(50, 54, 14, 46, 38, 0.48, 0), '#ff9a86', '#e0182e', '#7e0f1c', 9)
  const dome = 'M23 52C23 31 34 21 50 21s27 10 27 31c0 7-12 12-27 12s-27-5-27-12z'
  return svg(
    `<path d="M40 70h20L50 95z" fill="url(#sp-t)" stroke="${OUT}" stroke-width="5" stroke-linejoin="round"/>
    ${face}
    <ellipse cx="50" cy="55" rx="31" ry="13" fill="#7e0f1c" opacity=".35"/>
    <path d="${dome}" fill="url(#sp-c)" stroke="${OUT}" stroke-width="5" stroke-linejoin="round"/>
    <path d="${dome}" fill="url(#sp-g)"/>
    <ellipse cx="50" cy="26" rx="9" ry="5" fill="#ffd23a" stroke="${OUT}" stroke-width="4"/>
    <path d="M32 44c1-9 6-15 13-18" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" opacity=".8"/>
    <g stroke-linecap="round"><path d="M3 38h11M1 50h9M86 38h11M90 50h9" stroke="${OUT}" stroke-width="9"/><path d="M3 38h11M1 50h9M86 38h11M90 50h9" stroke="#7fe2ff" stroke-width="4"/></g>`,
    defs +
      vgrad('sp-c', [
        [0, '#b8f3ff'],
        [1, '#1f6fe0'],
      ]) +
      vgrad('sp-t', [
        [0, '#ffffff'],
        [1, '#9fb3c8'],
      ]),
  )
})()

/** A pink present with a gold ribbon and bow. */
const gift = (() => {
  const [box, boxDefs] = sticker('gb', 'M14 44h72v42a5 5 0 0 1-5 5H19a5 5 0 0 1-5-5z', '#ff9ae4', '#d4189e', '#7a0f5c', 5)
  const [lid, lidDefs] = sticker('gl', 'M9 33h82v14H9z', '#ffb3ee', '#e93db6', '#7a0f5c', 5)
  return svg(
    `${box}${lid}
    <path d="M43 33h14v58H43z" fill="url(#gr)" stroke="${OUT}" stroke-width="4.5"/>
    <path d="M50 33C40 12 17 15 27 31zM50 33c10-21 33-18 23-2z" fill="url(#gr)" stroke="${OUT}" stroke-width="5" stroke-linejoin="round"/>`,
    boxDefs +
      lidDefs +
      vgrad('gr', [
        [0, '#fff6a3'],
        [1, '#ffb300'],
      ]),
  )
})()

/** Settings: a silver gear with depth. */
const gear = (() => {
  const [g, defs] = sticker('ge', starPath(50, 46, 8, 44, 35, 1, 0), '#ffffff', '#a9b4c2', '#4a5568', 6)
  return svg(
    `${g}
    <circle cx="50" cy="46" r="14" fill="#4a5778" stroke="${OUT}" stroke-width="6"/>
    <circle cx="50" cy="46" r="6" fill="#2c344d"/>`,
    defs,
  )
})()

/** Daily rewards: a calendar page with depth. */
const calendar = (() => {
  const [page, defs] = sticker('ca', 'M10 26a10 10 0 0 1 10-10h60a10 10 0 0 1 10 10v54a10 10 0 0 1-10 10H20a10 10 0 0 1-10-10z', '#ffffff', '#dfe7f0', '#7a8aa3', 5)
  return svg(
    `${page}
    <path d="M10 26a10 10 0 0 1 10-10h60a10 10 0 0 1 10 10v12H10z" fill="url(#ca-r)" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
    <rect x="26" y="6" width="9" height="20" rx="4" fill="#cfd8e3" stroke="${OUT}" stroke-width="4"/>
    <rect x="65" y="6" width="9" height="20" rx="4" fill="#cfd8e3" stroke="${OUT}" stroke-width="4"/>
    <g stroke="${OUT}" stroke-width="2.5"><rect x="21" y="47" width="13" height="11" rx="2" fill="#ff9a1f"/><rect x="44" y="47" width="13" height="11" rx="2" fill="#ff9a1f"/><rect x="67" y="47" width="13" height="11" rx="2" fill="#ff9a1f"/><rect x="21" y="66" width="13" height="11" rx="2" fill="#ff9a1f"/><rect x="44" y="66" width="13" height="11" rx="2" fill="#2fd14a"/><rect x="67" y="66" width="13" height="11" rx="2" fill="#ff9a1f"/></g>`,
    defs +
      vgrad('ca-r', [
        [0, '#ff8a8a'],
        [1, '#d91c3a'],
      ]),
  )
})()

/** A gold padlock. */
const lock = (() => {
  const [body, defs] = sticker('lk', 'M16 46a8 8 0 0 1 8-8h52a8 8 0 0 1 8 8v34a8 8 0 0 1-8 8H24a8 8 0 0 1-8-8z', '#fff6a3', '#ffb300', '#8a5a00', 6)
  return svg(
    `<path d="M31 40V30c0-25 38-25 38 0v10" fill="none" stroke="${OUT}" stroke-width="15" stroke-linecap="round"/>
    <path d="M31 40V30c0-25 38-25 38 0v10" fill="none" stroke="#dfe7f0" stroke-width="7" stroke-linecap="round"/>
    ${body}
    <circle cx="50" cy="59" r="6" fill="${OUT}"/><path d="M50 61v11" stroke="${OUT}" stroke-width="7" stroke-linecap="round"/>`,
    defs,
  )
})()

/** The Wins Shop: a gacha machine - a glass globe full of capsules on a red base. */
const gacha = (() => {
  const [base, baseDefs] = sticker('ga', 'M22 58h56v28a7 7 0 0 1-7 7H29a7 7 0 0 1-7-7z', '#ff8a7a', '#e0182e', '#7e0f1c', 5)
  const capsule = (x, y, r, top) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${OUT}" stroke-width="2.5"/><path d="M${x - r} ${y}a${r} ${r} 0 0 1 ${r * 2} 0z" fill="${top}" stroke="${OUT}" stroke-width="2.5" stroke-linejoin="round"/>`
  return svg(
    `<circle cx="50" cy="37" r="29" fill="url(#ga-glass)"/>
    <g clip-path="url(#ga-clip)">
      ${capsule(37, 50, 8, '#ff4fd8')}${capsule(55, 52, 8, '#2fb8ff')}${capsule(68, 42, 7, '#ffd23a')}${capsule(46, 36, 7, '#57e83a')}${capsule(30, 36, 6, '#ff8a1c')}${capsule(60, 27, 7, '#9a5cff')}${capsule(42, 22, 6, '#ff3b5c')}
    </g>
    <circle cx="50" cy="37" r="29" fill="none" stroke="${OUT}" stroke-width="6"/>
    <ellipse cx="39" cy="22" rx="9" ry="5" transform="rotate(-35 39 22)" fill="#fff" opacity=".8"/>
    <path d="M44 6h12v6H44z" fill="#e0182e" stroke="${OUT}" stroke-width="4" stroke-linejoin="round"/>
    ${base}
    <rect x="43" y="63" width="14" height="5" rx="2" fill="${OUT}"/>
    <circle cx="50" cy="78" r="8" fill="url(#ga-gold)" stroke="${OUT}" stroke-width="4"/>
    <path d="M45 78h10" stroke="${OUT}" stroke-width="3.5" stroke-linecap="round"/>`,
    baseDefs +
      `<radialGradient id="ga-glass" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#a9dcf7"/></radialGradient>` +
      `<clipPath id="ga-clip"><circle cx="50" cy="37" r="26"/></clipPath>` +
      vgrad('ga-gold', GOLD),
  )
})()

/** Worlds: a swirling portal in a gold ring. */
const portalSwirl = (() => {
  const [frame, defs] = sticker('ps', circlePath(50, 46, 40), '#fff6a3', '#ffb300', '#8a5a00', 6)
  const spiral = 'M50 46c0-6 9-6 9 1s-12 10-17 2 4-19 15-17 17 12 13 22-17 17-27 12'
  return svg(
    `${frame}
    <circle cx="50" cy="46" r="30" fill="url(#ps-v)" stroke="${OUT}" stroke-width="5"/>
    <path d="${spiral}" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round" opacity=".9"/>
    <path d="${spiral}" transform="rotate(180 50 46)" fill="none" stroke="#7fe2ff" stroke-width="4.5" stroke-linecap="round" opacity=".85"/>
    <circle cx="50" cy="46" r="5" fill="#fff"/>
    <path d="M84 8l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" fill="#fff" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>`,
    defs +
      `<radialGradient id="ps-v" cx=".5" cy=".5" r=".55"><stop offset="0" stop-color="#7fe2ff"/><stop offset=".55" stop-color="#8a5cff"/><stop offset="1" stop-color="#3a1d8a"/></radialGradient>`,
  )
})()

/** Trails: a sneaker leaving a rainbow behind it. */
const sneaker = (() => {
  const upper = 'M30 62c0-13 9-22 21-22h7c4 8 11 13 24 16 7 2 8 12 1 14H33c-2 0-3-3-3-8z'
  const [shoe, defs] = sticker('sk', upper, '#ff8a7a', '#e0182e', '#7e0f1c', 4)
  return svg(
    `<g stroke-linecap="round" fill="none">
      <path d="M6 50h22M2 62h24M8 74h20" stroke="${OUT}" stroke-width="14"/>
      <path d="M6 50h22" stroke="#ff4fd8" stroke-width="7"/>
      <path d="M2 62h24" stroke="#ffe53b" stroke-width="7"/>
      <path d="M8 74h20" stroke="#2fc6ff" stroke-width="7"/>
    </g>
    ${shoe}
    <path d="M28 70h60a5 5 0 0 1 0 10H32a5 5 0 0 1-5-5z" fill="#ffffff" stroke="${OUT}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M47 46l8 4M44 52l8 4M41 58l8 4" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
    <path d="M58 64c8 0 15-2 22-6" fill="none" stroke="#ffd23a" stroke-width="5" stroke-linecap="round"/>`,
    defs,
  )
})()

/** Auras: a blocky avatar's head inside a glowing halo, with sparkles. */
const auraAvatar = (() => {
  const [head, headDefs] = sticker('av', 'M30 22a7 7 0 0 1 7-7h26a7 7 0 0 1 7 7v26a7 7 0 0 1-7 7H37a7 7 0 0 1-7-7z', '#ffe2c2', '#f1c27d', '#a86f3a', 5)
  const [body, bodyDefs] = sticker('ab', 'M20 70a10 10 0 0 1 10-10h40a10 10 0 0 1 10 10v20H20z', '#b6ff6a', '#3fbf2a', '#1a6a12', 4)
  return svg(
    `<circle cx="50" cy="44" r="44" fill="url(#av-glow)"/>
    <ellipse cx="50" cy="44" rx="41" ry="38" fill="none" stroke="${OUT}" stroke-width="12"/>
    <ellipse cx="50" cy="44" rx="41" ry="38" fill="none" stroke="url(#av-ring)" stroke-width="6"/>
    ${body}${head}
    <path d="M30 22a7 7 0 0 1 7-7h26a7 7 0 0 1 7 7v6H30z" fill="#6b3e1f" stroke="${OUT}" stroke-width="5" stroke-linejoin="round"/>
    <rect x="38" y="34" width="6" height="8" rx="1.5" fill="${OUT}"/><rect x="56" y="34" width="6" height="8" rx="1.5" fill="${OUT}"/>
    <path d="M42 47c4 3 12 3 16 0" fill="none" stroke="${OUT}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M88 60l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" fill="#fff" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M10 14l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>`,
    headDefs +
      bodyDefs +
      `<radialGradient id="av-glow"><stop offset=".5" stop-color="#ffe14d" stop-opacity=".9"/><stop offset="1" stop-color="#ffb300" stop-opacity="0"/></radialGradient>` +
      `<linearGradient id="av-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb3ff"/><stop offset=".5" stop-color="#b47cff"/><stop offset="1" stop-color="#7fe2ff"/></linearGradient>`,
  )
})()

const potionPower = potion(
  'pp',
  '#ff8a7a',
  '#d4142a',
  `<path d="M54 56l-14 16h10l-6 14 16-18H50z" fill="#ffd23a" stroke="${OUT}" stroke-width="3.5" stroke-linejoin="round"/>`,
)
const potionLucky = potion(
  'pl2',
  '#b6ff6a',
  '#19b52a',
  `<g fill="#2fae3a" stroke="${OUT}" stroke-width="3"><circle cx="44" cy="66" r="6"/><circle cx="56" cy="66" r="6"/><circle cx="50" cy="58" r="6"/><circle cx="50" cy="74" r="6"/></g>
   <path d="M50 74l4 10" stroke="${OUT}" stroke-width="3.5" stroke-linecap="round"/>`,
)

export const ICON_SVGS = {
  sound,
  soundOff,
  starGold,
  trophy,
  muscle,
  calendar,
  potionWins,
  potionPower,
  potionLucky,
  check,
  shop: gacha,
  portalSwirl,
  sneaker,
  auraAvatar,
  spinner,
  gift,
  gear,
  lock,
}

const urlCache = new Map()

/** `data:` URL for an icon name. */
export function iconUrl(name) {
  if (IMAGE_ICONS[name]) return IMAGE_ICONS[name]
  let url = urlCache.get(name)
  if (url) return url
  const markup = ICON_SVGS[name]
  if (!markup) return null
  url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
  urlCache.set(name, url)
  return url
}
