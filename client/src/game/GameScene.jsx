import { PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, lazy, memo, useCallback, useEffect, useRef, useState } from 'react'

import { C2S } from '@shared'

import { sfx } from '../audio/sfx'
import { DEBUG } from '../config'
import { send } from '../net/connection'
import { useGameStore } from '../store/gameStore'
import { live } from '../store/live'
import { useQuality, useQualityStore } from '../store/qualityStore'
import BattleView from './battle/BattleView'
import FollowCamera from './FollowCamera'
import Lighting from './Lighting'
import LocalPlayer from './LocalPlayer'
import { GameLoop } from './loop'
import Effects from './render/Effects'
import RemotePlayers from './RemotePlayers'
import { THEMES } from './sceneStyle'
import Sky from './Sky'
import Pets from './spinners/Pets'
import { setIconRenderer } from './spinners/iconRenderer'
import Lobby from './world/Lobby'

// The lobby is the first thing anyone sees, so it ships in the main bundle; each
// world is its own chunk, fetched the first time you step through its portal.
const WORLDS = {
  lava: lazy(() => import('./world/worlds/LavaWorld')),
  galaxy: lazy(() => import('./world/worlds/GalaxyWorld')),
  halloween: lazy(() => import('./world/worlds/HalloweenWorld')),
}

// r3f-perf (draw calls, triangles, GPU time) in development builds only.
const Perf = import.meta.env.DEV ? lazy(() => import('r3f-perf').then((m) => ({ default: m.Perf }))) : null

/** A click/tap on the 3D view: boost spinners in battle, train faster at a ring. */
function handleTap() {
  const b = live.battle
  if (b) {
    if (!b.ended && performance.now() - b.startAt > b.countdown * 1000) {
      send(C2S.click)
      sfx.click()
    }
    return
  }
  if (live.ring) {
    send(C2S.click)
    sfx.click()
  }
}

/**
 * Fires `onFirstFrame` after the renderer has actually drawn once.
 * `loadingEnd()` should mean "the player can see the game", not "React mounted".
 */
function FirstFrameSignal({ onFirstFrame }) {
  const fired = useRef(false)
  useFrame(() => {
    if (fired.current) return
    fired.current = true
    // Report from outside the frame callback: no React state updates inside useFrame.
    setTimeout(onFirstFrame, 0)
  })
  return null
}

/** Debug handle for the perf probe (`?debug`) - renderer stats without r3f-perf. */
function DebugHandle() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    if (!DEBUG) return undefined
    window.__game = {
      live,
      sceneRef: scene,
      store: useGameStore,
      quality: useQualityStore,
      send,
      info: () => ({
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        programs: gl.info.programs?.length || 0,
      }),
      /** Rough GPU memory of every texture in the scene (RGBA8 + mipmaps) plus shadow maps, in MB. */
      textureMB: () => {
        const seen = new Set()
        let bytes = 0
        const add = (t) => {
          if (!t || seen.has(t) || !t.image) return
          seen.add(t)
          const w = t.image.width || 0
          const h = t.image.height || 0
          bytes += w * h * 4 * (t.generateMipmaps === false ? 1 : 1.33)
        }
        scene.traverse((o) => {
          const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
          for (const m of mats) {
            for (const k of ['map', 'emissiveMap', 'alphaMap', 'normalMap']) add(m[k])
            if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture) add(u.value)
          }
          if (o.isLight && o.shadow && o.shadow.map) bytes += o.shadow.mapSize.x * o.shadow.mapSize.y * 4
        })
        return Math.round((bytes / 1048576) * 10) / 10
      },
    }
    // info auto-resets at the start of each render(), and the shadow pass happens
    // inside render(), so between frames these numbers cover one whole frame.
    return () => {
      delete window.__game
    }
  }, [gl, scene])
  return null
}

/** Longest we hold the first frame back waiting for shaders to compile. */
const WARMUP_TIMEOUT_MS = 3000

/**
 * Compiles every shader the scene needs in parallel (KHR_parallel_shader_compile)
 * before the first frame is drawn. Rendering first would instead block on each
 * program in turn - the biggest single cost of reaching playable on a phone.
 */
function ShaderWarmup({ ready, onWarm }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    if (!ready) return undefined
    let done = false
    const finish = () => {
      if (done) return
      done = true
      performance.mark('app:shaders-ready')
      onWarm()
    }
    gl.compileAsync(scene, camera).then(finish, finish)
    const timer = setTimeout(finish, WARMUP_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [ready, gl, scene, camera, onWarm])
  return null
}

/** Mounted alongside a zone's content: fires once that whole world has committed. */
function ZoneMounted({ onMounted }) {
  useEffect(() => {
    onMounted?.()
  }, [onMounted])
  return null
}

function ZoneContent({ zone }) {
  if (zone === 'lobby') return <Lobby />
  const World = WORLDS[zone]
  return World ? <World /> : null
}

export function GameScene({ onFirstFrame, onAvatarReady, onAvatarMounted, onZoneReady }) {
  const zone = useGameStore((s) => s.zone)
  const q = useQuality()
  const drop = useQualityStore((s) => s.drop)
  const [generation, setGeneration] = useState(0)
  const [lost, setLost] = useState(false)
  // Nothing renders until the first world is in and its shaders are compiled.
  const [zoneMounted, setZoneMounted] = useState(false)
  const [warm, setWarm] = useState(false)
  const theme = THEMES[zone] || THEMES.lobby

  const handleZoneMounted = useCallback(() => {
    setZoneMounted(true)
    onZoneReady?.()
  }, [onZoneReady])
  const handleWarm = useCallback(() => setWarm(true), [])

  const onCreated = useCallback(({ gl }) => {
    performance.mark('app:canvas')
    // Checking every shader for errors forces a synchronous wait on each program's
    // link. Worth it while developing; in production it only costs startup time.
    gl.debug.checkShaderErrors = import.meta.env.DEV
    setIconRenderer(gl)
    const canvas = gl.domElement
    canvas.addEventListener('webglcontextlost', (e) => {
      // Remounting the Canvas (quality change) deliberately drops the old context;
      // only a canvas still on the page has really lost its GPU.
      if (!canvas.isConnected) return
      // Tell the browser we want the context back.
      e.preventDefault()
      setLost(true)
    })
    canvas.addEventListener('webglcontextrestored', () => {
      setLost(false)
      // Rebuild every GPU resource from scratch on a fresh renderer.
      setGeneration((g) => g + 1)
    })
  }, [])

  const fogFar = Math.min(theme.fog.far, q.viewDistance)

  return (
    <>
      <Canvas
        // Antialiasing and shadow support are fixed when the context is created.
        key={`${generation}-${q.antialias}-${q.shadows}`}
        // PCF, not R3F's default "soft": three r18x removed PCFSoftShadowMap and falls
        // back to PCF with a console warning. PCF honours shadow.radius for soft edges.
        shadows={q.shadows ? 'percentage' : false}
        // No tone mapping. The default (ACES) compresses and desaturates highlights,
        // which turns the lime grass and blue sky muddy.
        flat
        dpr={q.dpr}
        gl={{ antialias: q.antialias, powerPreference: 'high-performance', stencil: false }}
        camera={{ position: [0, 8, 44], fov: 60, near: 0.3, far: q.viewDistance + 120 }}
        onCreated={onCreated}
        frameloop={warm ? 'always' : 'never'}
      >
        <ShaderWarmup ready={zoneMounted && !warm} onWarm={handleWarm} />
        <color attach="background" args={[theme.sky.horizon]} />
        <fog attach="fog" args={[theme.fog.color, Math.min(theme.fog.near, fogFar * 0.5), fogFar]} />
        <PerformanceMonitor onDecline={drop} flipflops={3} bounds={() => [45, 58]} />
        <GameLoop />
        <Sky theme={theme} />
        <Lighting theme={theme} />

        <Suspense fallback={null}>
          <LocalPlayer onAvatarReady={onAvatarReady} onAvatarMounted={onAvatarMounted} />
          <RemotePlayers />
        </Suspense>
        <Suspense fallback={null}>
          <ZoneContent zone={zone} />
          <ZoneMounted onMounted={handleZoneMounted} />
        </Suspense>

        <Effects />
        <Pets />
        <BattleView />
        <FollowCamera onTap={handleTap} />
        <FirstFrameSignal onFirstFrame={onFirstFrame} />
        <DebugHandle />
        {Perf && (
          <Suspense fallback={null}>
            <Perf position="bottom-right" minimal />
          </Suspense>
        )}
      </Canvas>
      {lost && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 text-2xl text-white game-font">
          Restoring graphics…
        </div>
      )}
    </>
  )
}

/**
 * Memoised: App re-renders as loading milestones arrive, and re-rendering the Canvas
 * makes the reconciler walk the whole 3D tree - over half a second on a phone. The
 * callbacks it takes are stable, so this only renders when the scene itself changes.
 */
export default memo(GameScene)
