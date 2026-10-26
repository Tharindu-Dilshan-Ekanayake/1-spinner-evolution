/**
 * Checks the real BattleSim against the balance model in scripts/simulate-balance.mjs
 * (win when team HP x team damage x 1.5 click boost > enemy HP x damage x 1.25).
 * Run: node scripts/battle-calibration.js
 */
import { BATTLE, stageArmy } from '../../shared/index.js'
import { BattleSim } from '../src/game/BattleSim.js'

function trial(stage, ratio, teamSize, cps) {
  const army = stageArmy('grassland', stage)
  // Team strength such that (hp*dmg*1.5) = ratio * (army.hp*army.dmg*1.25), hp = 12*dmg.
  const product = (ratio * army.hp * army.dmg * 1.25) / 1.5
  const totalDmg = Math.sqrt(product / 12)
  const team = Array.from({ length: teamSize }, () => ({ hp: (totalDmg * 12) / teamSize, dmg: totalDmg / teamSize }))
  const sim = new BattleSim({ team, army })
  const dt = BATTLE.tickMs / 1000
  let clickAcc = 0
  while (!sim.result) {
    clickAcc += cps * dt
    while (clickAcc >= 1) { sim.click(); clickAcc -= 1 }
    sim.step(dt)
  }
  return { result: sim.result, time: sim.time - BATTLE.countdown }
}

for (const stage of [3, 6, 10]) {
  for (const ratio of [0.6, 0.9, 1.0, 1.3, 2, 4]) {
    for (const teamSize of [2, 5]) {
      let wins = 0, time = 0
      const N = 60
      for (let i = 0; i < N; i++) { const r = trial(stage, ratio, teamSize, 4); if (r.result === 'win') wins++; time += r.time }
      console.log(`stage ${stage} ratio ${ratio} team ${teamSize}: win ${(wins / N * 100).toFixed(0)}%  avg ${(time / N).toFixed(1)}s`)
    }
  }
}
