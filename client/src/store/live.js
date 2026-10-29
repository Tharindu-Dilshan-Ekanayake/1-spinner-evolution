/**
 * Mutable per-frame game state, deliberately *outside* React.
 *
 * The frame loop reads and writes these objects 60 times a second; routing that
 * through React state would re-render the scene every frame. React (the HUD) reads
 * the slower-moving copies in the zustand store instead.
 *
 * Nothing here is allocated per frame: entries are created once and mutated.
 */
export const live = {
  /** Our Colyseus session id, to tell ourselves apart in the shared state. */
  selfId: null,
  /** Zone the client currently shows: 'lobby' or a world id. */
  zone: 'lobby',

  player: {
    x: 0,
    y: 0,
    z: 30,
    ry: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    grounded: true,
    speed: 0,
    anim: 0,
    /** Set while the server is moving us (battle, teleport); input is ignored. */
    frozen: false,
    /** Seconds since the last jump, for the pose. */
    airTime: 0,
    /** Bumped on every teleport so the camera snaps instead of swooping. */
    warp: 0,
    /** Walk speed multiplier from the equipped trail. */
    speedMult: 1,
  },

  /** Raw input, written by keyboard/touch handlers. */
  input: {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    /** Virtual joystick, -1..1 each. */
    joyX: 0,
    joyY: 0,
  },

  camera: {
    yaw: 0,
    pitch: 0.38,
    distance: 13,
    /** 'follow' | 'battle' */
    mode: 'follow',
    /** World-space point the battle camera frames. */
    focus: { x: 0, y: 0, z: 0 },
  },

  /** sessionId -> remote player (see net/connection.js) */
  remotes: new Map(),
  /** Same players as a plain array, so the frame loop iterates without allocating. */
  remoteList: [],

  /** Our equipped team, mirrored from the profile: [{ id, golden, uid, hp, hpText }] */
  team: [],
  /** Our equipped aura and trail ids. */
  profileCosmetics: null,
  /** Training ring id we're at, or null. */
  ring: null,
  /** Training/battle hit events from the server, consumed by the pets system. */
  gains: [],

  /** Active battle (see game/battle/battleState.js), or null. */
  battle: null,

  /** World-space effects requested from outside the frame loop. */
  fx: [],

  /** Current run: { world, cleared } - gates read this. */
  run: null,
}

/** Queue an effect for the fx system ('levelUp', 'rebirth', 'poof', ...). */
export function pushFx(type, x, y, z, extra) {
  live.fx.push({ type, x, y, z, extra })
}
