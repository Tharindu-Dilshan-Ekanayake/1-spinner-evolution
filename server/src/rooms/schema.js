import { schema, t } from '@colyseus/schema'

/**
 * Public, synced state: what every client in the room needs to draw the other
 * players. Private progression (wins, inventory, quests) is NOT here - it goes to its
 * owner only, as messages (see WorldRoom.sendProfile).
 */
export const PlayerState = schema(
  {
    name: t.string(),
    x: t.float32(),
    y: t.float32(),
    z: t.float32(),
    ry: t.float32(),
    /** ANIM in shared/protocol.js */
    anim: t.uint8(),
    /** 'lobby' or a world id; clients only draw players in their own zone. */
    zone: t.string(),
    level: t.uint16(),
    rebirths: t.uint16(),
    trail: t.string(),
    aura: t.string(),
    /** Equipped spinners as "id" or "id*" (golden), in slot order. */
    team: t.array('string'),
    /** Training ring id while training, '' otherwise. Lets others see spinners attack. */
    ring: t.string(),
    battling: t.boolean(),
    /** Bloxity avatar (equipped ids + proportions) as JSON, so others see our look. */
    avatar: t.string(),
    /** Boxity account id, only once Boxity has verified it ('' for guests): chat
     *  bubbles find their speaker by it. */
    uid: t.string(),
    /** Boxity emote being played ('' for none); emoteSeq ticks each time one starts,
     *  so the same emote twice in a row still plays twice. */
    emote: t.string(),
    emoteSeq: t.uint8(),
  },
  'PlayerState',
)

export const WorldState = schema(
  {
    players: t.map(PlayerState),
  },
  'WorldState',
)
