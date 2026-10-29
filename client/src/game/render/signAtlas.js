import {
  CanvasTexture,
  FrontSide,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from 'three'

/**
 * All the text in a world - "TRAIN POWER", "Basic Capsule 3 Wins", "Stage 4 148 HP" -
 * drawn into ONE canvas atlas and rendered as ONE instanced mesh.
 *
 * sign = { x, y, z, ry, w, h, draw(ctx, pw, ph), billboard?, double?, far?, near? }
 *   w/h are world units; draw() paints into a pw x ph pixel rect (origin moved there).
 *   billboard signs turn around Y to face the camera.
 *   far: past this distance the sign fades out (floating labels only show up close, so
 *        the scene never fills with overlapping text).
 *   near: closer than this the sign fades out too (labels over things you walk up to,
 *        so they don't crowd the prompt that appears there).
 *
 * Unlit (MeshBasicMaterial) so signs stay bright like Roblox SurfaceGuis.
 */

export const FONT = '"Fredoka One", "Arial Black", system-ui, sans-serif'

/**
 * Assigning ctx.font makes the browser re-parse the font string, which made it the
 * biggest cost of drawing signs on a phone. Skip it when the size hasn't changed.
 * (save()/restore() reset the font, so the atlas clears this cache around them.)
 */
function setFont(ctx, size) {
  if (ctx.__fontSize === size) return
  ctx.font = `${size}px ${FONT}`
  ctx.__fontSize = size
}

/** Chunky outlined game text. */
export function drawText(ctx, text, x, y, size, fill = '#ffffff', stroke = '#1b1b2a', align = 'center') {
  setFont(ctx, size)
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(3, size * 0.15)
  ctx.strokeStyle = stroke
  ctx.strokeText(text, x, y)
  if (Array.isArray(fill)) {
    const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2)
    fill.forEach((c, i) => g.addColorStop(i / (fill.length - 1), c))
    ctx.fillStyle = g
  } else {
    ctx.fillStyle = fill
  }
  ctx.fillText(text, x, y)
}

/**
 * Largest font size up to `size` at which `text` fits `maxWidth`. Text width scales
 * linearly with font size, so one measurement is enough.
 */
export function fitSize(ctx, text, size, maxWidth) {
  setFont(ctx, size)
  const width = ctx.measureText(text).width
  return width > maxWidth ? Math.max(8, Math.floor((size * maxWidth) / width)) : size
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

const _m = new Matrix4()
const _q = new Quaternion()
const _p = new Vector3()
const _s = new Vector3()
const _up = new Vector3(0, 1, 0)

/**
 * @param {Array} signs
 * @param {{ atlasSize?: number, density?: number }} opts  density = pixels per world unit
 */
export function createSignAtlas(signs, { atlasSize = 1024, density = 40 } = {}) {
  // Shelf-pack rects; shrink density until everything fits.
  let rects
  let d = density
  for (let attempt = 0; attempt < 8; attempt += 1) {
    rects = []
    let x = 2
    let y = 2
    let row = 0
    let ok = true
    const order = signs.map((s, i) => i).sort((a, b) => signs[b].h - signs[a].h)
    for (const i of order) {
      const s = signs[i]
      const pw = Math.ceil(s.w * d)
      const ph = Math.ceil(s.h * d)
      if (pw > atlasSize - 4) {
        ok = false
        break
      }
      if (x + pw > atlasSize - 2) {
        x = 2
        y += row + 2
        row = 0
      }
      if (y + ph > atlasSize - 2) {
        ok = false
        break
      }
      rects[i] = { x, y, pw, ph }
      x += pw + 2
      row = Math.max(row, ph)
    }
    if (ok) break
    d *= 0.82
  }

  const canvas = document.createElement('canvas')
  // An empty atlas (a placeholder that only gets its shader compiled) needs no pixels.
  canvas.width = signs.length ? atlasSize : 1
  canvas.height = signs.length ? atlasSize : 1
  const ctx = canvas.getContext('2d')
  signs.forEach((s, i) => {
    const r = rects[i]
    if (!r) return
    ctx.save()
    ctx.beginPath()
    ctx.rect(r.x, r.y, r.pw, r.ph)
    ctx.clip()
    ctx.translate(r.x, r.y)
    s.draw(ctx, r.pw, r.ph)
    ctx.restore()
    ctx.__fontSize = null
  })

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4

  const geometry = new PlaneGeometry(1, 1)
  const rectAttr = new InstancedBufferAttribute(new Float32Array(signs.length * 4), 4)
  const billAttr = new InstancedBufferAttribute(new Float32Array(signs.length), 1)
  const farAttr = new InstancedBufferAttribute(new Float32Array(signs.length), 1)
  const nearAttr = new InstancedBufferAttribute(new Float32Array(signs.length), 1)
  rectAttr.setUsage(DynamicDrawUsage)
  geometry.setAttribute('iRect', rectAttr)
  geometry.setAttribute('iBill', billAttr)
  geometry.setAttribute('iFar', farAttr)
  geometry.setAttribute('iNear', nearAttr)

  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.05,
    // One-sided: wall signs vanish from behind instead of showing mirrored text
    // (billboards always face the camera anyway).
    side: FrontSide,
    toneMapped: false,
    // Signs hang a hair in front of their boards: pulled forward in the depth test so
    // the board behind can never flicker through at a distance.
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  })
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec4 iRect;
        attribute float iBill;
        attribute float iFar;
        attribute float iNear;`,
      )
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n vMapUv = vec2(iRect.x + uv.x * iRect.z, iRect.y + uv.y * iRect.w);')
      .replace(
        '#include <project_vertex>',
        `vec4 mvPosition;
        if (iBill > 0.5) {
          vec3 center = instanceMatrix[3].xyz;
          vec2 scale = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
          vec3 camRight = normalize(vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]));
          vec3 world = center + camRight * position.x * scale.x + vec3(0.0, 1.0, 0.0) * position.y * scale.y;
          mvPosition = viewMatrix * modelMatrix * vec4(world, 1.0);
        } else {
          mvPosition = modelViewMatrix * instanceMatrix * vec4(transformed, 1.0);
        }
        // Fade signs the camera is about to pass through instead of filling the screen.
        vSignFade = smoothstep(max(3.0, iNear * 0.7), max(9.0, iNear), -mvPosition.z);
        // ...and floating labels beyond their range, so they never pile up.
        if (iFar > 0.0) vSignFade *= 1.0 - smoothstep(iFar * 0.75, iFar, -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;`,
      )
      .replace('#include <common>', '#include <common>\n varying float vSignFade;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n varying float vSignFade;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.a *= vSignFade;')
  }

  const mesh = new InstancedMesh(geometry, material, signs.length)
  signs.forEach((s, i) => {
    const r = rects[i] || { x: 0, y: 0, pw: 1, ph: 1 }
    // Canvas y grows down, texture v grows up (flipY).
    rectAttr.setXYZW(i, r.x / atlasSize, 1 - (r.y + r.ph) / atlasSize, r.pw / atlasSize, r.ph / atlasSize)
    billAttr.setX(i, s.billboard ? 1 : 0)
    farAttr.setX(i, s.far || 0)
    nearAttr.setX(i, s.near || 0)
    _p.set(s.x, s.y, s.z)
    _q.setFromAxisAngle(_up, s.ry || 0)
    _s.set(s.w, s.h, 1)
    _m.compose(_p, _q, _s)
    mesh.setMatrixAt(i, _m)
  })
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingSphere()
  // Billboards move vertices in the shader; don't let a tight sphere cull them.
  mesh.frustumCulled = false

  return {
    mesh,
    texture,
    /**
     * Shows sign `i` at `amount` (0..1) of its height, kept hanging from its top edge,
     * so a board can roll up out of sight and back down again.
     */
    setShown(i, amount) {
      const s = signs[i]
      const k = Math.max(0, Math.min(1, amount))
      _p.set(s.x, s.y + (s.h / 2) * (1 - k), s.z)
      _q.setFromAxisAngle(_up, s.ry || 0)
      if (k > 0.001) _s.set(s.w, s.h * k, 1)
      else _s.set(0, 0, 0)
      _m.compose(_p, _q, _s)
      mesh.setMatrixAt(i, _m)
      mesh.instanceMatrix.needsUpdate = true
    },
    /** Re-run the draw() of every sign (e.g. leaderboards changed). */
    redraw(next) {
      ctx.clearRect(0, 0, atlasSize, atlasSize)
      ;(next || signs).forEach((s, i) => {
        const r = rects[i]
        if (!r) return
        ctx.save()
        ctx.translate(r.x, r.y)
        s.draw(ctx, r.pw, r.ph)
        ctx.restore()
        ctx.__fontSize = null
      })
      texture.needsUpdate = true
    },
    dispose() {
      geometry.dispose()
      material.dispose()
      texture.dispose()
      mesh.dispose()
    },
  }
}
