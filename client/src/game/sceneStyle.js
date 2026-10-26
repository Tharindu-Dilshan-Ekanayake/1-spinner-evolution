/**
 * The scene's whole look in one place: a bright toy-brick world with a saturated blue
 * sky, lime studded baseplate, tan checker brick walls and orange wooden fences.
 *
 * Colours are sRGB hex, exactly as you would pick them in an image editor.
 *
 * Light intensities are three.js physical units: a light of intensity PI (~3.14)
 * lights a surface facing it to its full texture colour. The hemisphere fill plus the
 * sun add up to just over that on the ground, which is what keeps the greens vivid;
 * shadowed ground only gets the fill, so shadows read as a softer, darker green.
 */

export const SKY = {
  /** Straight up. */
  top: '#2a8af5',
  /** At eye level. Fog uses the same colour so distant ground melts into the sky. */
  horizon: '#86c8fb',
  /** Lower = the deep blue reaches further down towards the horizon. */
  exponent: 0.3,
}

/** Just a light haze at the far end of the track. */
export const FOG = {
  color: SKY.horizon,
  near: 120,
  far: 420,
}

export const CLOUDS = {
  /** Sunlit tops. */
  top: '#ffffff',
  /** Undersides, a cool blue-grey. */
  bottom: '#cfdff2',
  count: 18,
}

/** Neon lime baseplate, two shades in a checker. */
export const GROUND = {
  base: '#5cee30',
  alt: '#52de2b',
}

/** Tan checker brick for the boundary walls. */
export const WALLS = {
  base: '#c4955c',
  alt: '#a3774a',
}

export const FENCE = {
  rail: '#c8662e',
  post: '#a8501f',
}

export const LIGHTS = {
  /** Fill from above (sky) and below (bounce off the grass). */
  hemiSky: '#ffffff',
  hemiGround: '#b7c9a3',
  hemiIntensity: 2.1,

  sunColor: '#fff6e8',
  sunIntensity: 1.7,
  /**
   * Direction *towards* the sun: high and a little to the left, behind the default
   * camera, so the side of the character you look at is lit and its shadow falls
   * beside it where you can see it, not hidden behind its back.
   */
  sunDirection: [-0.35, 0.9, 0.2],
  /** 1 = shadows get no sunlight at all; lower = lighter shadows. */
  shadowIntensity: 0.8,
  /** Blur radius of shadow edges, in shadow-map texels. */
  shadowSoftness: 4,
}

/**
 * Per-zone looks. The lobby and Grassland use the bright toy-brick palette above;
 * the other worlds swap sky, fog, light and the colours their islands are built in.
 *
 * ground/alt: island top; path: walkways; edge: island sides; trim: arena rims and
 * wall caps; wall: castle walls; arena: arena floor tint.
 */
export const THEMES = {
  lobby: {
    sky: { top: SKY.top, horizon: SKY.horizon, exponent: SKY.exponent },
    fog: { color: SKY.horizon, near: 90, far: 330 },
    ground: '#52e02b',
    path: '#a9b8e8',
    edge: '#5f6fb0',
    trim: '#ff9a3c',
    wall: '#7f8fd6',
    arena: '#8e9fe0',
    hemi: 2.1,
    sun: 1.7,
    sunColor: LIGHTS.sunColor,
    clouds: true,
  },
  grassland: {
    sky: { top: '#2f8ff7', horizon: '#9ad2fd', exponent: 0.32 },
    fog: { color: '#9ad2fd', near: 90, far: 320 },
    ground: '#4fdc2a',
    path: '#a9b8e8',
    edge: '#5f6fb0',
    trim: '#ff8c2e',
    wall: '#8090d8',
    arena: '#8e9fe0',
    hemi: 2.1,
    sun: 1.7,
    sunColor: LIGHTS.sunColor,
    clouds: true,
  },
  lava: {
    sky: { top: '#3a0a0a', horizon: '#ff6a2a', exponent: 0.55 },
    fog: { color: '#a8381a', near: 60, far: 260 },
    ground: '#4a3a3a',
    path: '#6b5552',
    edge: '#2a1d1d',
    trim: '#ff5a12',
    wall: '#5a4646',
    arena: '#6e5a58',
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
    edge: '#151838',
    trim: '#2cf3ff',
    wall: '#3c3f7e',
    arena: '#4a4e96',
    hemi: 1.7,
    sun: 1.3,
    sunColor: '#c8b8ff',
    clouds: false,
    stars: true,
  },
  halloween: {
    sky: { top: '#0d0420', horizon: '#5a2a6e', exponent: 0.5 },
    fog: { color: '#3a1d4a', near: 50, far: 220 },
    ground: '#3f8a2a',
    path: '#7a6a8e',
    edge: '#2e2440',
    trim: '#ff7a00',
    wall: '#5e4f7a',
    arena: '#6f6290',
    hemi: 1.5,
    sun: 1.1,
    sunColor: '#c9b8ff',
    clouds: false,
    stars: true,
    moon: true,
  },
}
