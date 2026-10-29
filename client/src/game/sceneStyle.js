/**
 * The scene's whole look in one place. It shares its palette with the studio's
 * +1 Slide Downhill (a touch more saturated): a bright toy-brick world with a deep blue
 * sky, a fresh lime plaza, warm yellow brick paths with orange edges, light-blue aprons with white rims,
 * green lawns, tan dirt, and white / blue / navy / gold for everything built.
 *
 * Colours are sRGB hex, exactly as you would pick them in an image editor.
 *
 * Light intensities are three.js physical units: a light of intensity PI (~3.14)
 * lights a surface facing it to its full texture colour. The hemisphere fill plus the
 * sun add up to just over that on the ground, which is what keeps the colours vivid;
 * shadowed ground only gets the fill, so shadows read as a softer, darker shade.
 */

export const SKY = {
  /** Straight up. */
  top: '#2a8bff',
  /** At eye level. Fog uses the same colour so distant ground melts into the sky. */
  horizon: '#a0dcff',
  /** Lower = the deep blue reaches further down towards the horizon. */
  exponent: 0.35,
}

export const CLOUDS = {
  /** Sunlit tops. */
  top: '#ffffff',
  /** Undersides, a cool blue-grey. */
  bottom: '#d3e6fa',
}

/** Every surface colour of the daylight worlds (lobby, Grassland). */
export const PALETTE = {
  plaza: '#a9e86b',
  path: '#ffe28c',
  pathEdge: '#f4b45c',
  /** The spawn plaza: a light warm stone between the yellow walkways. */
  plazaStone: '#fff1d2',
  apron: '#acdff5',
  apronEdge: '#e6f6fd',
  lawn: '#5fd146',
  dirt: '#d39a57',
  trunk: '#7c4d29',
  leaves: ['#2fd23c', '#44de45', '#25c034'],
  hedge: '#4fd93a',
  stem: '#2f9a2a',
  flowers: ['#ff5c8a', '#ffe45c', '#ffffff', '#ff8a3c', '#b47cff'],
  wood: '#8a5a32',
  /** Built things, as in the slide's arch and shop: white decks on blue, navy panels, gold caps. */
  white: '#f4f7fb',
  blue: '#2f7fe6',
  navy: '#1f3c96',
  sky: '#7fe2ff',
  gold: '#ffd21f',
  ink: '#1f2742',
  water: '#4cc3ff',
}

export const LIGHTS = {
  /** Fill from above (sky) and below (bounce off the ground). */
  hemiSky: '#ffffff',
  hemiGround: '#b9cba6',
  hemiIntensity: 2.1,

  sunColor: '#fff6e8',
  sunIntensity: 1.65,
  /**
   * Direction *towards* the sun: high and a little to the left, behind the default
   * camera, so the side of the character you look at is lit and its shadow falls
   * beside it where you can see it, not hidden behind its back.
   */
  sunDirection: [-0.35, 0.9, 0.25],
  /** 1 = shadows get no sunlight at all; lower = lighter shadows. */
  shadowIntensity: 0.7,
  /** Blur radius of shadow edges, in shadow-map texels. */
  shadowSoftness: 3,
}

const DAYLIGHT = {
  sky: SKY,
  fog: { color: SKY.horizon, near: 90, far: 330 },
  ground: PALETTE.plaza,
  path: PALETTE.path,
  pathEdge: PALETTE.pathEdge,
  edge: PALETTE.dirt,
  trim: PALETTE.gold,
  wall: PALETTE.blue,
  arena: PALETTE.apron,
  arenaWall: PALETTE.navy,
  banner: PALETTE.navy,
  band: PALETTE.white,
  light: PALETTE.sky,
  hemiSky: LIGHTS.hemiSky,
  hemiGround: LIGHTS.hemiGround,
  hemi: LIGHTS.hemiIntensity,
  sun: LIGHTS.sunIntensity,
  sunColor: LIGHTS.sunColor,
  clouds: true,
}

/**
 * Per-zone looks. The lobby and Grassland use the daylight palette above; the other
 * worlds swap sky, fog, light and the colours their islands are built in.
 *
 * ground: island top; path/pathEdge: walkways; edge: island sides; trim: wall caps and
 * gold accents; wall: castle walls; arena/arenaWall: arena floor tint and rim (also the
 * walls' plinths); banner: the flags on the castle walls; band/light: the band along
 * the top of the walls and the light strip under it.
 */
export const THEMES = {
  lobby: DAYLIGHT,
  grassland: DAYLIGHT,
  lava: {
    sky: { top: '#3a0a0a', horizon: '#ff6a2a', exponent: 0.55 },
    fog: { color: '#a8381a', near: 60, far: 260 },
    ground: '#4a3a3a',
    path: '#6b5552',
    pathEdge: '#3a2a28',
    edge: '#2a1d1d',
    trim: '#ff5a12',
    wall: '#5a4646',
    arena: '#a08884',
    arenaWall: '#2a1d1d',
    banner: '#ff5a12',
    band: '#6b5552',
    light: '#ffb000',
    hemiSky: LIGHTS.hemiSky,
    hemiGround: '#6a4a3a',
    hemi: 1.6,
    sun: 1.5,
    sunColor: '#ffb48a',
    clouds: false,
    lava: true,
  },
  galaxy: {
    sky: { top: '#05021a', horizon: '#3a1d7a', exponent: 0.45 },
    fog: { color: '#2a1660', near: 70, far: 300 },
    ground: '#2b2f5e',
    path: '#5b5fa8',
    pathEdge: '#1d2050',
    edge: '#151838',
    trim: '#2cf3ff',
    wall: '#3c3f7e',
    arena: '#8a8ee0',
    arenaWall: '#6a00ff',
    banner: '#8a3dff',
    band: '#5b5fa8',
    light: '#2cf3ff',
    hemiSky: '#d8d0ff',
    hemiGround: '#3a3070',
    hemi: 1.7,
    sun: 1.3,
    sunColor: '#c8b8ff',
    clouds: false,
    stars: true,
  },
}
