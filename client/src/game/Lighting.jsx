import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { Vector3 } from 'three'

import { live } from '../store/live'
import { useQuality } from '../store/qualityStore'
import { LIGHTS } from './sceneStyle'

const SUN_DIRECTION = new Vector3(...LIGHTS.sunDirection).normalize()
/** How far back along SUN_DIRECTION the light sits from the point it shadows. */
const SUN_DISTANCE = 60
const SUN_START = SUN_DIRECTION.clone().multiplyScalar(SUN_DISTANCE).toArray()
/** Half-size of the square area around the player that receives shadows. */
const SHADOW_EXTENT = 26

/**
 * Bright, even daylight: a hemisphere fill and a warm sun with soft shadows.
 *
 * A directional light's shadow only covers a fixed box around its target, so the sun
 * and its target follow the player every frame. Shadows are off entirely on the LOW
 * preset (blob shadows under spinners still read fine there).
 *
 * @param {{ theme: object }} props zone theme from sceneStyle.THEMES
 */
export function Lighting({ theme }) {
  const sunRef = useRef(null)
  const scene = useThree((s) => s.scene)
  const q = useQuality()

  useLayoutEffect(() => {
    const sun = sunRef.current
    if (!sun) return undefined

    const shadowCamera = sun.shadow.camera
    shadowCamera.left = -SHADOW_EXTENT
    shadowCamera.right = SHADOW_EXTENT
    shadowCamera.top = SHADOW_EXTENT
    shadowCamera.bottom = -SHADOW_EXTENT
    shadowCamera.near = 1
    shadowCamera.far = SUN_DISTANCE * 2
    shadowCamera.updateProjectionMatrix()

    // The target has to be in the scene for its matrix to update as it moves.
    scene.add(sun.target)
    return () => {
      scene.remove(sun.target)
    }
  }, [scene, q.shadows, q.shadowMapSize])

  useFrame(() => {
    const sun = sunRef.current
    if (!sun) return
    // Snap to a grid so shadow edges don't shimmer as the player walks.
    const x = Math.round(live.player.x)
    const z = Math.round(live.player.z)
    sun.target.position.set(x, 0, z)
    sun.position.copy(sun.target.position).addScaledVector(SUN_DIRECTION, SUN_DISTANCE)
  })

  return (
    <>
      <hemisphereLight args={[theme.hemiSky, theme.hemiGround, theme.hemi]} />
      <directionalLight
        // Remount when the shadow map size changes; three won't resize a live one.
        key={`${q.shadows}-${q.shadowMapSize}`}
        ref={sunRef}
        castShadow={q.shadows}
        color={theme.sunColor}
        intensity={theme.sun}
        position={SUN_START}
        shadow-mapSize={[q.shadowMapSize || 512, q.shadowMapSize || 512]}
        shadow-radius={LIGHTS.shadowSoftness}
        shadow-intensity={LIGHTS.shadowIntensity}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
      />
    </>
  )
}

export default Lighting
