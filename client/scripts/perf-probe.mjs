/**
 * Drives the game in headless Chrome and records what the performance budget needs:
 * draw calls, triangles, GPU memory (geometries/textures), FPS - per scene and per
 * quality preset - plus screenshots of every scene.
 *
 * Needs: the game server running with ALLOW_CHEATS=1 (to jump to late worlds) and the
 * client served (vite dev or preview) - see README "Performance".
 *
 *   GAME_URL=http://localhost:5199/?debug node scripts/perf-probe.mjs out-dir
 *
 * ANGLE=swiftshader forces software WebGL (always works, FPS meaningless);
 * default d3d11 uses the real GPU when Chrome can.
 */
import fs from 'node:fs'
import path from 'node:path'

import puppeteer, { PredefinedNetworkConditions } from 'puppeteer-core'

const URL = process.env.GAME_URL || 'http://localhost:5199/?debug'
const OUT = path.resolve(process.argv[2] || 'perf-out')
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const ANGLE = process.env.ANGLE || 'd3d11'

fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const report = { url: URL, angle: ANGLE, scenes: [], errors: [] }

async function waitForGame(page) {
  await page.waitForFunction(() => window.__game && window.__game.store.getState().profile, { timeout: 60000 })
  await sleep(2500)
}

async function measure(page, name, { shot = true, settle = 1500 } = {}) {
  await sleep(settle)
  const data = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const g = window.__game
        let frames = 0
        const start = performance.now()
        let worst = 0
        let last = start
        const tick = (t) => {
          frames += 1
          worst = Math.max(worst, t - last)
          last = t
          if (t - start < 3000) requestAnimationFrame(tick)
          else {
            const info = g.info()
            resolve({
              textureMB: g.textureMB(),
              fps: Math.round((frames * 1000) / (t - start)),
              worstFrameMs: Math.round(worst),
              ...info,
              preset: g.quality.getState().preset,
              zone: g.store.getState().zone,
            })
          }
        }
        requestAnimationFrame(tick)
      }),
  )
  if (shot) await page.screenshot({ path: path.join(OUT, `${name}.png`) })
  report.scenes.push({ name, ...data })
  console.log(name.padEnd(28), JSON.stringify(data))
  return data
}

async function setPreset(page, preset) {
  await page.evaluate((p) => window.__game.quality.getState().choose(p), preset)
  // Canvas remounts when shadows/antialias change.
  await sleep(2500)
}

async function moveTo(page, x, z, ry = Math.PI) {
  await page.evaluate(
    ({ x, z, ry }) => {
      const p = window.__game.live.player
      p.x = x
      p.z = z
      p.y = 0.5
      p.ry = ry
      p.vx = 0
      p.vz = 0
      p.warp += 1
      window.__game.live.camera.yaw = ry + Math.PI
    },
    { x, z, ry },
  )
}

async function send(page, type, payload) {
  await page.evaluate(({ type, payload }) => window.__game.send(type, payload), { type, payload })
}

async function teleport(page, to) {
  await send(page, 'teleport', { to })
  await page.waitForFunction((z) => window.__game.store.getState().zone === z, { timeout: 20000 }, to)
  await sleep(2500)
}

async function run(viewport, label, presets) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      `--use-angle=${ANGLE}`,
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--enable-gpu-rasterization',
      '--autoplay-policy=no-user-gesture-required',
      `--window-size=${viewport.width},${viewport.height}`,
    ],
  })
  const page = await browser.newPage()
  await page.setViewport(viewport)
  if (viewport.isMobile) {
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36')
  }
  page.on('pageerror', (e) => report.errors.push(`${label}: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') report.errors.push(`${label}: ${m.text()}`)
  })

  // A fresh guest each run.
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => localStorage.clear())
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await waitForGame(page)

  const gl = await page.evaluate(() => {
    const c = document.createElement('canvas').getContext('webgl2')
    const ext = c && c.getExtension('WEBGL_debug_renderer_info')
    return ext ? c.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown'
  })
  report[`${label}Renderer`] = gl
  console.log(`[${label}] GPU: ${gl}`)

  const detected = await page.evaluate(() => window.__game.quality.getState().preset)
  report[`${label}DetectedPreset`] = detected
  await measure(page, `${label}-lobby-auto-${detected}`)

  // Spawn, facing the stage line.
  for (const preset of presets) {
    await setPreset(page, preset)
    await moveTo(page, 0, 0)
    await measure(page, `${label}-lobby-spawn-${preset}`)
  }

  // Behind the spawn: the TRAIN POWER rings.
  await moveTo(page, 0, 6, 0)
  await measure(page, `${label}-lobby-training-view`)

  // Training at the Beginner ring (pets attack the dummy).
  await moveTo(page, -20 + 9.6, 32, -Math.PI / 2)
  await page.evaluate(() => {
    let n = 0
    const t = setInterval(() => {
      window.__game.send('click')
      if (++n > 40) clearInterval(t)
    }, 120)
  })
  await measure(page, `${label}-training`, { settle: 3000 })

  // Left: the Wins Shop. Right: the leaderboards.
  await moveTo(page, -16, 0, -Math.PI / 2)
  await measure(page, `${label}-lobby-shop-view`)
  await moveTo(page, 26, 0, Math.PI / 2)
  await measure(page, `${label}-lobby-leaderboards-view`)

  // Capsule popup.
  await moveTo(page, -30, -3.5, Math.PI)
  await measure(page, `${label}-capsule`, { settle: 1500 })

  // A fair fight first: the starter team against stage 1, right in front of the lobby.
  await moveTo(page, 0, -14)
  await measure(page, `${label}-stage-gate`)
  await battle(page, `${label}-grassland-battle`)
  // After the win: the Return pad and the Stage 2 gate past the arena.
  await moveTo(page, 4, -74, Math.PI)
  await measure(page, `${label}-return-pad`)
  await moveTo(page, 0, 0)

  // Late-game account so every world opens (test server only).
  await send(page, 'debug', {
    rebirths: 8,
    wins: 5e6,
    candy: 500,
    level: 40,
    best: { grassland: 10, lava: 20, galaxy: 22, halloween: 3 },
    give: ['crystal', 'phoenix_blade', 'galaxy_core', 'void_star', 'storm_blade', 'pumpkin_spin', 'ghost_whirl', 'violet_fang'],
  })
  await sleep(1200)
  await page.evaluate(() => window.__game.store.getState().setPanel('spinners'))
  await measure(page, `${label}-panel-spinners`, { settle: 2500 })
  await page.evaluate(() => window.__game.store.getState().closePanel())

  await moveTo(page, 0, 0)
  await measure(page, `${label}-lobby-full-team`)

  for (const world of ['lava', 'galaxy', 'halloween']) {
    await teleport(page, world)
    await measure(page, `${label}-${world}-spawn`)
  }
  await battle(page, `${label}-halloween-battle`)

  await browser.close()
}

/** Touch stage 1's gate, screenshot mid-fight, measure, then the result. */
async function battle(page, name) {
  // Gate 1's glass is at z = -34; pressing against it starts the fight.
  await moveTo(page, 0, -32.8, Math.PI)
  await page.waitForFunction(() => window.__game.live.battle, { timeout: 15000 }).catch(() => {})
  // Countdown is 2.2s; catch the clash right after it.
  await sleep(3000)
  await page.screenshot({ path: path.join(OUT, `${name}-fight.png`) })
  await page.evaluate(() => {
    let n = 0
    const t = setInterval(() => {
      window.__game.send('click')
      if (++n > 40) clearInterval(t)
    }, 120)
  })
  await measure(page, name, { settle: 200, shot: false })
  await page.waitForFunction(() => window.__game.store.getState().battleResult, { timeout: 60000 }).catch(() => {})
  await sleep(400)
  await page.screenshot({ path: path.join(OUT, `${name}-result.png`) })
  // After a win the gate behind you slides open: look back at it from the arena side.
  await sleep(2600)
  await moveTo(page, 9, -39, 0)
  await sleep(1500)
  await page.screenshot({ path: path.join(OUT, `${name}-door.png`) })
}

/**
 * Time to playable on a throttled phone: cold cache + network profile + 4x CPU
 * slowdown, until the loading screen is gone (scene drawn, avatar built, save
 * received). Records a timeline of milestones and the bytes actually transferred.
 */
async function timeToPlayable(profile) {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: [`--use-angle=${ANGLE}`, '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true })
  // A phone user agent, so the game picks the preset a real phone gets (LOW).
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36')
  const client = await page.createCDPSession()
  await client.send('Network.enable')
  await client.send('Network.setCacheDisabled', { cacheDisabled: true })
  await page.emulateNetworkConditions(PredefinedNetworkConditions[profile])
  const cpu = Number(process.env.TTP_CPU || 4)
  await page.emulateCPUThrottling(cpu)
  let bytes = 0
  const files = []
  const urls = new Map()
  client.on('Network.responseReceived', (e) => urls.set(e.requestId, e.response.url))
  client.on('Network.loadingFinished', (e) => {
    bytes += e.encodedDataLength
    files.push([urls.get(e.requestId) || '?', e.encodedDataLength])
  })
  const t0 = Date.now()
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  const timeline = await page.evaluate(
    (start) =>
      new Promise((resolve) => {
        const marks = {}
        const tick = () => {
          const now = Date.now() - start
          const g = window.__game
          if (!marks.canvas && g) marks.canvas = now
          const st = g && g.store.getState()
          if (!marks.online && st && st.status === 'online') marks.online = now
          if (!marks.profile && st && st.profile) marks.profile = now
          if (!marks.playable && st && st.profile && !document.body.innerText.includes('Building the world')) {
            marks.playable = now
            resolve(marks)
            return
          }
          if (now > 90000) return resolve(marks)
          setTimeout(tick, 50)
        }
        tick()
      }),
    t0,
  )
  const marks = await page.evaluate(() => {
    const out = {}
    for (const m of performance.getEntriesByType('mark')) out[m.name] = Math.round(m.startTime)
    for (const r of performance.getEntriesByType('resource')) {
      if (/three-|react-vendor-|legion-sdk|player.glb|Lobby-/.test(r.name)) out[r.name.split('/').pop().slice(0, 24)] = Math.round(r.responseEnd)
    }
    out.domContentLoaded = Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd)
    return out
  })
  timeline.marks = marks
  report.timeToPlayable = report.timeToPlayable || {}
  const preset = await page.evaluate(() => window.__game.quality.getState().preset)
  report.timeToPlayable[profile] = {
    preset,
    cpuSlowdown: cpu,
    timeline,
    transferredKB: Math.round(bytes / 1024),
    files: files.map(([u, n]) => [u.replace(/^https?:\/\/[^/]+/, '').slice(0, 70), Math.round(n / 1024)]),
  }
  console.log(`time-to-playable (${profile}, ${cpu}x CPU, ${preset}): ${timeline.playable} ms  ${JSON.stringify(timeline)}  ${Math.round(bytes / 1024)} KB`)
  await browser.close()
}

if (!process.env.TTP_SKIP) {
  await timeToPlayable('Fast 4G')
  await timeToPlayable('Slow 4G')
}
if (process.env.TTP_ONLY) {
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  process.exit(0)
}
await run({ width: 1280, height: 720 }, 'desktop', ['HIGH', 'MEDIUM', 'LOW'])
// Phone in landscape: touch + mobile UA -> auto LOW preset.
if (!process.env.DESKTOP_ONLY) await run({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'mobile', [])

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(`\nErrors (${report.errors.length}):`)
for (const e of report.errors.slice(0, 30)) console.log(' -', e)
console.log(`\nScreenshots + report.json in ${OUT}`)
