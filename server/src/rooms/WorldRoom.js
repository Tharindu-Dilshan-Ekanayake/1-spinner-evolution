import { Room } from '@colyseus/core'

import {
  ANIM,
  BATTLE,
  C2S,
  CAPSULES,
  CAPSULE_POSITIONS,
  CRYSTAL_POSITION,
  LIMITS,
  LOBBY,
  LOBBY_SPOTS,
  PUMPKINS,
  RINGS,
  S2C,
  STAGE,
  TRAINER_LINES,
  TUNING,
  WORLDS,
  computeStats,
  dist2d,
  doorExit,
  encodeFrame,
  equippedSpinners,
  hasPerk,
  gateFront,
  nearGate,
  playerPad,
  questProgress,
  returnPad,
  ringAt,
  spinnerStats,
  stageArmy,
  stageCandy,
  stageWins,
  trainGain,
  worldOfZone,
  worldUnlocked,
  WORLDS_PORTAL,
  zoneOfWorld,
} from '../../../shared/index.js'
import { BattleSim } from '../game/BattleSim.js'
import * as eco from '../game/economy.js'
import { getLeaderboards } from '../game/leaderboard.js'
import { addSpinner, createProfile, equipBest, fixEquipped, grantPower, migrateProfile, teamCodes } from '../game/profiles.js'
import { getProfile, markDirty, putProfile, saveNow } from '../game/store.js'
import { PlayerState, WorldState } from './schema.js'

/** Which room each profile is currently playing in, so a second tab kicks the first. */
const activeSessions = new Map()

const STATS_EVERY_TICKS = 4
const AUTO_DELAY_S = 2.5

const pick = (list) => list[Math.floor(Math.random() * list.length)]
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

/** Strips anything that isn't a sensible display name. */
function cleanName(name) {
  const s = String(name || '')
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .trim()
    .slice(0, 20)
  return s || `Spinner${Math.floor(Math.random() * 9000 + 1000)}`
}

function cleanId(id) {
  const s = String(id || '')
  return /^[\w:.-]{4,80}$/.test(s) ? s : null
}

/**
 * The one room type: a shared lobby plus every world. Up to 16 players see each
 * other; each player's training, battles and stage run are simulated here.
 */
export class WorldRoom extends Room {
  maxClients = 16

  onCreate() {
    this.state = new WorldState()
    /** sessionId -> Session (see onJoin) */
    this.sessions = new Map()
    this.tickCount = 0

    const on = (type, handler) =>
      this.onMessage(type, (client, message) => {
        const session = this.sessions.get(client.sessionId)
        if (!session) return
        try {
          handler(session, message ?? {})
        } catch (err) {
          console.error(`[room] ${type} failed for ${session.key}`, err)
        }
      })

    on(C2S.move, (s, m) => this.onMove(s, m))
    on(C2S.click, (s) => this.onClick(s))
    on(C2S.train, (s, m) => this.onTrain(s, m.ring || null))
    on(C2S.fight, (s, m) => this.fightGate(s, String(m.world || ''), Number(m.stage)))
    on(C2S.giveUp, (s) => s.battle && this.endBattle(s, 'giveup'))
    on(C2S.collectRun, (s) => this.collectRun(s, true))
    on(C2S.teleport, (s, m) => this.teleport(s, String(m.to || 'lobby'), String(m.spot || '')))
    on(C2S.openCapsule, (s, m) => this.openCapsule(s, String(m.capsule), Number(m.count) || 1))
    on(C2S.buyCrystal, (s) => this.buyCrystal(s))
    on(C2S.equip, (s, m) => this.act(s, eco.equip(s.profile, Number(m.uid)), { team: true }))
    on(C2S.unequip, (s, m) => this.act(s, eco.unequip(s.profile, Number(m.uid)), { team: true }))
    on(C2S.equipBest, (s) => this.act(s, eco.doEquipBest(s.profile), { team: true }))
    on(C2S.unequipAll, (s) => this.act(s, eco.unequipAll(s.profile), { team: true }))
    on(C2S.deleteSpinners, (s, m) =>
      this.act(s, eco.deleteSpinners(s.profile, (m.uids || []).map(Number)), { team: true }),
    )
    on(C2S.lockSpinner, (s, m) => this.act(s, eco.lockSpinner(s.profile, Number(m.uid))))
    on(C2S.craftGolden, (s, m) => {
      const result = eco.craftGolden(s.profile, String(m.id))
      if (this.act(s, result, { team: true })) {
        s.client.send(S2C.capsule, { capsule: 'golden', results: result.results })
      }
    })
    on(C2S.buyTrail, (s, m) => this.act(s, eco.buyTrail(s.profile, String(m.id)), { cosmetics: true, sound: 'buy' }))
    on(C2S.equipTrail, (s, m) => this.act(s, eco.equipTrail(s.profile, String(m.id || '')), { cosmetics: true }))
    on(C2S.buyAura, (s, m) => this.act(s, eco.buyAura(s.profile, String(m.id)), { cosmetics: true, sound: 'buy' }))
    on(C2S.equipAura, (s, m) => this.act(s, eco.equipAura(s.profile, String(m.id || '')), { cosmetics: true }))
    on(C2S.rebirth, (s) => this.doRebirth(s))
    on(C2S.usePotion, (s, m) => this.act(s, eco.usePotion(s.profile, String(m.id)), { sound: 'potion' }))
    on(C2S.claimGift, (s, m) => this.reward(s, eco.claimGift(s.profile, String(m.id)), 'Gift'))
    on(C2S.claimDaily, (s) => this.reward(s, eco.claimDaily(s.profile), 'Daily reward'))
    on(C2S.pumpkin, (s, m) => this.collectPumpkin(s, String(m.id)))
    on(C2S.autoWin, (s, m) => this.setAutoWin(s, Boolean(m.on)))
    on(C2S.ping, (s, m) => s.client.send(S2C.pong, { t: m.t }))

    // Lets the perf probe / testers jump to late-game content. Never on in production.
    if (process.env.ALLOW_CHEATS === '1') {
      on(C2S.debug, (s, m) => {
        const p = s.profile
        for (const key of ['rebirths', 'wins', 'candy', 'level']) if (isNum(m[key])) p[key] = m[key]
        if (m.best && typeof m.best === 'object') Object.assign(p.best, m.best)
        if (Array.isArray(m.give)) for (const id of m.give) if (typeof id === 'string') addSpinner(p, id, Boolean(m.golden))
        equipBest(p)
        this.syncPublic(s, { team: true, cosmetics: true })
        s.profileDirty = true
      })
    }

    this.setSimulationInterval((dtMs) => this.tick(dtMs / 1000), BATTLE.tickMs)
    this.clock.setInterval(() => this.broadcast(S2C.leaderboards, getLeaderboards()), 30000)
  }

  /* -------------------------------------------------------------------------
   * Join / leave
   * ----------------------------------------------------------------------- */

  onJoin(client, options = {}) {
    // Logged-in Bloxity players are keyed by their account id; guests by a random id
    // their browser keeps. NOTE: the Bloxity token is not verified yet (see the
    // /api/legion-auth TODO in http.js), so a determined client could claim any id.
    const userId = cleanId(options.userId)
    const guestId = cleanId(options.guestId)
    const key = userId ? `u:${userId}` : guestId ? `g:${guestId}` : `s:${client.sessionId}`
    const name = cleanName(options.name)

    const previous = activeSessions.get(key)
    if (previous && previous.client !== client) {
      previous.client.send(S2C.toast, { text: 'You joined from another window.', kind: 'error' })
      previous.client.leave(4001)
    }

    let profile = getProfile(key)
    if (profile) migrateProfile(profile)
    else {
      profile = createProfile(key, name)
      putProfile(key, profile)
    }
    profile.name = name
    profile.lastSeen = Date.now()
    eco.rollGiftDay(profile)

    const player = new PlayerState()
    Object.assign(player, {
      name,
      x: LOBBY.spawn.x,
      y: LOBBY.spawn.y,
      z: LOBBY.spawn.z,
      ry: LOBBY.spawn.ry,
      anim: ANIM.idle,
      zone: 'lobby',
      level: profile.level,
      rebirths: profile.rebirths,
      trail: profile.trail,
      aura: profile.aura,
      ring: '',
      battling: false,
      avatar: typeof options.avatar === 'string' ? options.avatar.slice(0, 2000) : '',
    })
    player.team.push(...teamCodes(profile))
    this.state.players.set(client.sessionId, player)

    const session = {
      client,
      key,
      profile,
      player,
      pos: { x: player.x, y: player.y, z: player.z },
      zone: 'lobby',
      ring: null,
      trainTimers: [],
      battle: null,
      run: null,
      clickTokens: LIMITS.clicksPerSecond,
      pending: null,
      gains: [],
      statsDirty: false,
      profileDirty: false,
    }
    this.sessions.set(client.sessionId, session)
    activeSessions.set(key, { client, room: this })

    this.sendProfile(session)
    client.send(S2C.leaderboards, getLeaderboards())
    const done = eco.checkQuests(profile)
    if (done.length) this.announceQuests(session, done)
  }

  onLeave(client) {
    const session = this.sessions.get(client.sessionId)
    if (!session) return
    if (session.run) this.payRun(session)
    session.profile.lastSeen = Date.now()
    markDirty()
    this.sessions.delete(client.sessionId)
    this.state.players.delete(client.sessionId)
    if (activeSessions.get(session.key)?.client === client) activeSessions.delete(session.key)
  }

  onDispose() {
    saveNow()
  }

  /* -------------------------------------------------------------------------
   * Sync helpers
   * ----------------------------------------------------------------------- */

  sendProfile(s) {
    s.profileDirty = false
    s.statsDirty = false
    s.client.send(S2C.profile, { profile: s.profile, quest: this.questInfo(s), daily: eco.dailyStatus(s.profile) })
  }

  sendStats(s) {
    s.statsDirty = false
    const p = s.profile
    s.client.send(S2C.stats, {
      level: p.level,
      power: p.power,
      wins: p.wins,
      candy: p.candy,
      rebirths: p.rebirths,
      playtime: p.stats.playtime,
      giftSeconds: p.gifts.seconds,
    })
  }

  questInfo(s) {
    const q = questProgress(s.profile)
    return { index: q.index, text: q.quest.text, progress: q.progress, target: q.target }
  }

  /** Copies profile fields other players can see into the schema. */
  syncPublic(s, { team = false, cosmetics = false } = {}) {
    const { player, profile } = s
    player.level = profile.level
    player.rebirths = profile.rebirths
    if (cosmetics) {
      player.trail = profile.trail
      player.aura = profile.aura
    }
    if (team) {
      const codes = teamCodes(profile)
      const same = codes.length === player.team.length && codes.every((c, i) => player.team[i] === c)
      if (!same) {
        player.team.clear()
        player.team.push(...codes)
      }
      s.trainTimers = []
    }
  }

  /** Applies an economy result: toast on error, otherwise resync. Returns ok. */
  act(s, result, { team = false, cosmetics = false, sound = null } = {}) {
    if (!result.ok) {
      s.client.send(S2C.toast, { text: result.error, kind: 'error' })
      return false
    }
    this.syncPublic(s, { team, cosmetics })
    s.profileDirty = true
    if (sound) s.client.send(S2C.fx, { t: sound })
    this.afterProgress(s)
    markDirty()
    return true
  }

  reward(s, result, label) {
    if (!result.ok) {
      s.client.send(S2C.toast, { text: result.error, kind: 'error' })
      return
    }
    s.client.send(S2C.reward, { label, reward: result.reward, day: result.day })
    s.profileDirty = true
    this.afterProgress(s)
    markDirty()
  }

  /** Quest check after anything that can progress one. */
  afterProgress(s) {
    const done = eco.checkQuests(s.profile)
    if (done.length) this.announceQuests(s, done)
    s.client.send(S2C.quest, this.questInfo(s))
  }

  announceQuests(s, done) {
    for (const q of done) s.client.send(S2C.reward, { label: 'Quest complete!', text: q.text, reward: q.reward })
    s.profileDirty = true
  }

  /* -------------------------------------------------------------------------
   * Movement and zones
   * ----------------------------------------------------------------------- */

  onMove(s, m) {
    if (!Array.isArray(m) || m.length < 5) return
    const [x, y, z, ry, anim] = m
    if (![x, y, z, ry, anim].every(isNum)) return
    // Movement is client-driven (it's not competitive); only keep it inside sane
    // bounds. Anything that pays out re-checks the position itself.
    if (Math.abs(x) > 400 || Math.abs(z) > 800 || y < -200 || y > 200) return
    if (s.battle) return
    s.pos.x = x
    s.pos.y = y
    s.pos.z = z
    const p = s.player
    p.x = x
    p.y = y
    p.z = z
    p.ry = ry
    p.anim = anim & 0xff
  }

  place(s, zone, spot) {
    s.zone = zone
    s.pos = { x: spot.x, y: spot.y || 0, z: spot.z }
    const p = s.player
    p.zone = zone
    p.x = spot.x
    p.y = spot.y || 0
    p.z = spot.z
    p.ry = spot.ry || 0
    s.client.send(S2C.teleported, { zone, x: spot.x, y: spot.y || 0, z: spot.z, ry: spot.ry || 0 })
  }

  teleport(s, to, spotName = '') {
    if (s.battle) this.endBattle(s, 'giveup')
    this.onTrain(s, null)
    s.pending = null

    // Grassland is the lobby's own stage line: stand in front of its first gate.
    if (to === 'grassland') {
      to = 'lobby'
      spotName = 'stages'
    }

    if (to === 'lobby') {
      // Leaving another world banks its run; warps inside the lobby keep yours.
      const from = s.zone
      if (s.run && zoneOfWorld(s.run.world) !== 'lobby') this.payRun(s)
      const named = Object.hasOwn(LOBBY_SPOTS, spotName) && LOBBY_SPOTS[spotName]
      const spot = named || (from !== 'lobby' ? doorExit(WORLDS_PORTAL) : LOBBY.spawn)
      this.place(s, 'lobby', spot)
      this.sendRun(s)
      return
    }

    const world = WORLDS[to]
    if (!world || zoneOfWorld(to) !== to) return
    if (!worldUnlocked(to, s.profile)) {
      const why =
        s.profile.rebirths < world.rebirths
          ? `Requires Rebirth ${world.rebirths}!`
          : world.event
            ? `Clear Stage ${world.requiresStage} first!`
            : `Clear Stage ${world.requiresStage} first!`
      s.client.send(S2C.toast, { text: why, kind: 'error' })
      return
    }
    if (s.run) this.payRun(s)
    s.run = { world: to, cleared: 0, wins: 0, candy: 0 }
    this.place(s, to, STAGE.spawn)
    this.sendRun(s)
  }

  /* -------------------------------------------------------------------------
   * Training
   * ----------------------------------------------------------------------- */

  onTrain(s, ringId) {
    if (!ringId) {
      if (s.ring) {
        s.ring = null
        s.player.ring = ''
      }
      return
    }
    const ring = RINGS[ringId]
    if (!ring || s.zone !== 'lobby' || s.battle) return
    if (ringAt(s.pos, 4) !== ringId) return
    if (s.profile.rebirths < ring.rebirths) {
      s.client.send(S2C.toast, { text: `${ring.name} ring requires Rebirth ${ring.rebirths}!`, kind: 'error' })
      return
    }
    s.ring = ringId
    s.player.ring = ringId
    s.trainTimers = []
  }

  /** Power for one full volley (every equipped spinner hitting once). */
  volley(s, stats) {
    let total = 0
    for (const sp of equippedSpinners(s.profile)) {
      total += trainGain(spinnerStats(sp.id, sp.golden).dmg, s.ring || 'beginner', stats)
    }
    return total
  }

  givePower(s, amount) {
    const change = grantPower(s.profile, amount)
    s.statsDirty = true
    if (change) {
      s.client.send(S2C.levelUp, { from: change.from, to: change.to })
      if (change.gifts.length) s.client.send(S2C.capsule, { capsule: 'gift', results: change.gifts })
      this.broadcast(S2C.fx, { t: 'levelUp', id: s.client.sessionId }, { except: s.client })
      this.syncPublic(s, { team: true })
      s.profileDirty = true
      this.afterProgress(s)
    }
  }

  onClick(s) {
    if (s.clickTokens < 1) return
    s.clickTokens -= 1
    const stats = computeStats(s.profile)
    if (s.battle) {
      if (!s.battle.sim.started || s.battle.sim.result) return
      s.battle.sim.click()
      const gain = this.volley(s, stats) * TUNING.battleClickShare
      if (gain > 0) this.givePower(s, gain)
      return
    }
    if (!s.ring || ringAt(s.pos, 4) !== s.ring) return
    const gain = this.volley(s, stats) * TUNING.trainClickShare
    if (gain > 0) {
      s.gains.push(-1, gain)
      this.givePower(s, gain)
    }
  }

  trainTick(s, dt) {
    if (!s.ring) return
    if (ringAt(s.pos, 4) !== s.ring) {
      this.onTrain(s, null)
      return
    }
    const team = equippedSpinners(s.profile)
    if (!team.length) return
    const stats = computeStats(s.profile)
    let total = 0
    for (let i = 0; i < team.length; i += 1) {
      // Stagger spinners so hits land one after another, not all at once.
      if (s.trainTimers[i] === undefined) s.trainTimers[i] = -i * (TUNING.trainInterval / team.length)
      s.trainTimers[i] += dt
      if (s.trainTimers[i] >= TUNING.trainInterval) {
        s.trainTimers[i] -= TUNING.trainInterval
        const gain = trainGain(spinnerStats(team[i].id, team[i].golden).dmg, s.ring, stats)
        s.gains.push(i, gain)
        total += gain
      }
    }
    if (total > 0) this.givePower(s, total)
  }

  /* -------------------------------------------------------------------------
   * Battles and stage runs
   * ----------------------------------------------------------------------- */

  sendRun(s) {
    s.client.send(S2C.run, s.run ? { ...s.run } : null)
  }

  /**
   * Touching gate k's glass ("KILL THE ENEMIES TO ENTER"): fight stage k from the
   * blue pad behind it. Gate 1 also starts the run.
   */
  fightGate(s, worldId, k) {
    if (s.battle || !Number.isInteger(k)) return
    const world = WORLDS[worldId]
    if (!world || worldOfZone(s.zone) !== worldId) return
    const cleared = s.run && s.run.world === worldId ? s.run.cleared : 0
    if (k !== cleared + 1 || k > world.stageCount) return
    if (!nearGate(k, s.pos, 3)) return
    if (!s.run || s.run.world !== worldId) {
      if (s.run) this.payRun(s)
      s.run = { world: worldId, cleared: 0, wins: 0, candy: 0 }
    }
    this.beginStage(s, k)
  }

  /** Puts the player on stage k's blue pad and starts the fight. */
  beginStage(s, k) {
    const run = s.run
    const world = WORLDS[run.world]
    const team = equippedSpinners(s.profile)
    if (!team.length) {
      s.client.send(S2C.toast, { text: 'Equip a spinner first!', kind: 'error' })
      return
    }

    this.onTrain(s, null)
    const pad = playerPad(k)
    // On the blue pad, facing the arena.
    this.place(s, zoneOfWorld(run.world), { x: pad.x, y: 0, z: pad.z, ry: Math.PI })
    this.sendRun(s)
    const stats = computeStats(s.profile)
    const global = world.event ? k : world.firstStage + k - 1
    const army = stageArmy(run.world, global)
    const sim = new BattleSim({
      team: team.map((sp) => {
        const st = spinnerStats(sp.id, sp.golden)
        return { hp: st.hp * stats.hpMult, dmg: st.dmg * stats.dmgMult }
      }),
      army,
    })
    s.battle = { sim, world: run.world, k, global }
    s.pending = null
    s.player.battling = true
    s.player.anim = ANIM.battle

    s.client.send(S2C.battleStart, {
      world: run.world,
      stage: k,
      global,
      units: sim.units.map((u, i) => ({
        side: u.side,
        id: u.side === 0 ? team[i].id : null,
        golden: u.side === 0 ? team[i].golden : false,
        boss: u.boss,
        maxHp: Math.ceil(u.maxHp),
        r: u.r,
        x: u.x,
        z: u.z,
      })),
      countdown: BATTLE.countdown,
      line: pick(TRAINER_LINES.start),
    })
  }

  battleTick(s, dt) {
    const b = s.battle
    if (!b) return
    b.sim.step(dt)
    s.client.send(S2C.battleFrame, encodeFrame(b.sim.time, b.sim.boost, b.sim.units, b.sim.hits))
    if (b.sim.result) this.endBattle(s, b.sim.result)
  }

  endBattle(s, result) {
    const b = s.battle
    if (!b) return
    s.battle = null
    s.player.battling = false
    s.player.anim = ANIM.idle

    const p = s.profile
    const won = result === 'win'
    const run = s.run
    let reward = { wins: 0, candy: 0 }

    if (won && run) {
      const stats = computeStats(p)
      reward = {
        wins: Math.round(stageWins(b.world, b.global) * stats.winsMult),
        candy: Math.round(stageCandy(b.world, b.k) * stats.candyMult),
      }
      run.cleared = b.k
      run.wins += reward.wins
      run.candy += reward.candy
      const bestValue = WORLDS[b.world].event ? b.k : b.global
      if (bestValue > (p.best[b.world] || 0)) p.best[b.world] = bestValue
      p.stats.battlesWon += 1
    } else {
      p.stats.battlesLost += 1
    }

    const finished = won && run && run.cleared >= WORLDS[b.world].stageCount
    s.client.send(S2C.battleEnd, {
      result,
      world: b.world,
      stage: b.k,
      reward,
      run: run ? { ...run } : null,
      finished,
      line: pick(won ? TRAINER_LINES.playerWon : TRAINER_LINES.playerLost),
    })

    if (won) {
      // No teleport: the gate behind opens, the next one waits past the arena.
      this.sendRun(s)
      if (s.profile.autoWin && hasPerk(p.rebirths, 'autoWin')) {
        s.pending = { at: AUTO_DELAY_S, action: finished ? 'restart' : 'next' }
      }
    } else if (run) {
      // Lost (or gave up): back in front of the gate. The run - and the Return pad
      // with everything won so far - stays; train up and try again.
      this.place(s, zoneOfWorld(b.world), gateFront(b.k))
      this.sendRun(s)
      if (s.profile.autoWin && hasPerk(p.rebirths, 'autoWin') && result !== 'giveup') {
        s.pending = { at: AUTO_DELAY_S + 1, action: 'restart' }
      }
    }
    s.profileDirty = true
    this.afterProgress(s)
    markDirty()
  }

  /** Banks the run's wins and candy into the profile. */
  payRun(s) {
    const run = s.run
    if (!run) return
    if (run.wins > 0 || run.candy > 0) {
      eco.grantReward(s.profile, { wins: run.wins, candy: run.candy })
      s.client.send(S2C.reward, {
        label: run.cleared >= (WORLDS[run.world]?.stageCount || 99) ? 'World cleared!' : 'Run complete!',
        reward: { wins: run.wins, candy: run.candy },
        run: true,
      })
      s.profileDirty = true
    }
    s.run = null
    markDirty()
  }

  /** The Return pad: cash out the run and go back to the lobby spawn. */
  collectRun(s, viaPad) {
    const run = s.run
    if (!run || s.battle || run.cleared < 1) return
    if (viaPad) {
      if (s.zone !== zoneOfWorld(run.world)) return
      let near = false
      for (let j = 1; j <= run.cleared; j += 1) {
        if (dist2d(s.pos, returnPad(j)) <= STAGE.returnPadRadius + 3) near = true
      }
      if (!near) return
    }
    this.onTrain(s, null)
    s.pending = null
    this.payRun(s)
    this.place(s, 'lobby', LOBBY.spawn)
    this.sendRun(s)
  }

  setAutoWin(s, on) {
    if (on && !hasPerk(s.profile.rebirths, 'autoWin')) {
      s.client.send(S2C.toast, { text: 'AUTO WIN unlocks at Rebirth 3!', kind: 'error' })
      return
    }
    s.profile.autoWin = on
    s.profileDirty = true
    if (!on) {
      s.pending = null
      return
    }
    if (s.battle) return
    // Carry on the current run, or start one on this zone's stage line (the lobby's
    // is Grassland).
    const worldId = s.run ? s.run.world : worldOfZone(s.zone)
    if (!worldId) return
    if (!s.run) s.run = { world: worldId, cleared: 0, wins: 0, candy: 0 }
    const done = s.run.cleared >= WORLDS[worldId].stageCount
    s.pending = { at: 0.5, action: done ? 'restart' : 'next' }
  }

  /** AUTO WIN: put the player on the next blue pad and fight, forever. */
  pendingTick(s, dt) {
    const job = s.pending
    if (!job || s.battle) return
    job.at -= dt
    if (job.at > 0) return
    s.pending = null
    if (!s.profile.autoWin || !s.run) return
    if (job.action === 'restart') {
      const world = s.run.world
      this.payRun(s)
      s.run = { world, cleared: 0, wins: 0, candy: 0 }
    }
    const k = s.run.cleared + 1
    if (k > WORLDS[s.run.world].stageCount) return
    this.beginStage(s, k)
  }

  /* -------------------------------------------------------------------------
   * Shop actions that depend on where you stand
   * ----------------------------------------------------------------------- */

  openCapsule(s, capsuleId, count) {
    const capsule = CAPSULES[capsuleId]
    const spot = CAPSULE_POSITIONS[capsuleId]
    if (!capsule || !spot) return
    if (s.zone !== 'lobby' || dist2d(s.pos, spot) > 9) {
      s.client.send(S2C.toast, { text: `Walk up to the ${capsule.name} to open it!`, kind: 'error' })
      return
    }
    const result = eco.openCapsule(s.profile, capsuleId, count)
    if (this.act(s, result, { team: true })) {
      s.client.send(S2C.capsule, { capsule: capsuleId, results: result.results })
    }
  }

  buyCrystal(s) {
    if (s.zone !== 'lobby' || dist2d(s.pos, CRYSTAL_POSITION) > 9) {
      s.client.send(S2C.toast, { text: 'Walk up to the Crystal Spinner to buy it!', kind: 'error' })
      return
    }
    const result = eco.buyCrystal(s.profile)
    if (this.act(s, result, { team: true })) {
      s.client.send(S2C.capsule, { capsule: 'crystal', results: result.results })
    }
  }

  doRebirth(s) {
    if (s.battle) return
    const result = eco.rebirth(s.profile)
    if (!this.act(s, result, { team: true })) return
    this.onTrain(s, null)
    this.broadcast(S2C.fx, { t: 'rebirth', id: s.client.sessionId })
    s.client.send(S2C.toast, { text: `REBIRTH ${result.rebirths}! Power x${(1 + TUNING.rebirthStep * result.rebirths).toFixed(1)}`, kind: 'rebirth' })
  }

  collectPumpkin(s, id) {
    const pk = PUMPKINS.find((p) => p.id === id)
    if (!pk || s.zone !== 'lobby' || dist2d(s.pos, pk) > 4) return
    const result = eco.collectPumpkin(s.profile, id)
    if (!result.ok) return
    s.client.send(S2C.reward, { label: 'Pumpkin!', reward: result.reward, quiet: true, pumpkin: id })
    s.profileDirty = true
    this.afterProgress(s)
    markDirty()
  }

  /* -------------------------------------------------------------------------
   * Tick
   * ----------------------------------------------------------------------- */

  tick(dt) {
    this.tickCount += 1
    const statsTick = this.tickCount % STATS_EVERY_TICKS === 0

    for (const s of this.sessions.values()) {
      const p = s.profile
      s.clickTokens = Math.min(LIMITS.clicksPerSecond, s.clickTokens + LIMITS.clicksPerSecond * dt)
      p.stats.playtime += dt
      p.gifts.seconds += dt

      if (s.battle) this.battleTick(s, dt)
      else {
        this.trainTick(s, dt)
        this.pendingTick(s, dt)
      }

      if (s.gains.length) {
        s.client.send(S2C.gain, s.gains)
        s.gains = []
      }

      if (s.profileDirty) {
        fixEquipped(p)
        this.sendProfile(s)
      } else if (s.statsDirty && statsTick) {
        this.sendStats(s)
      }
    }

    // Every 10s, refresh stats anyway so playtime/gift timers stay in sync.
    if (this.tickCount % 200 === 0) {
      for (const s of this.sessions.values()) this.sendStats(s)
    }
  }
}

