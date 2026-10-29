import { useMemo } from 'react'
import { CanvasTexture, Color, MeshLambertMaterial, PlaneGeometry, SRGBColorSpace } from 'three'

import { boxMatrix } from './builders'
import { InstancedSet } from './Instanced'

/**
 * The glossy face plate on every pad you stand on (the stages' blue and red pads,
 * the training pads): a bevelled panel in the pad's colour with a glowing white inner
 * line, four chevrons pointing in and a ring in the middle - "stand here".
 *
 * One flat quad per pad, all pads of an area in one draw call. The white lines come
 * from an emissive map, so they glow white whatever colour the pad is tinted.
 */

const SIZE = 256

function drawPad(ctx, glow) {
  const s = SIZE
  ctx.fillStyle = glow ? '#000000' : '#ffffff'
  ctx.fillRect(0, 0, s, s)
  if (!glow) {
    // Bevel: lighter middle, darker rim.
    const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.15, s / 2, s / 2, s * 0.72)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(1, '#9aa4b4')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
  }
  ctx.strokeStyle = '#ffffff'
  ctx.fillStyle = '#ffffff'
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  // Inner rounded line.
  const m = s * 0.12
  const r = s * 0.1
  ctx.lineWidth = s * 0.03
  ctx.beginPath()
  ctx.moveTo(m + r, m)
  ctx.arcTo(s - m, m, s - m, s - m, r)
  ctx.arcTo(s - m, s - m, m, s - m, r)
  ctx.arcTo(m, s - m, m, m, r)
  ctx.arcTo(m, m, s - m, m, r)
  ctx.closePath()
  ctx.stroke()
  // Chevrons pointing to the middle from each side.
  ctx.lineWidth = s * 0.035
  for (let i = 0; i < 4; i += 1) {
    ctx.save()
    ctx.translate(s / 2, s / 2)
    ctx.rotate((i * Math.PI) / 2)
    ctx.beginPath()
    ctx.moveTo(-s * 0.09, -s * 0.31)
    ctx.lineTo(0, -s * 0.22)
    ctx.lineTo(s * 0.09, -s * 0.31)
    ctx.stroke()
    ctx.restore()
  }
  // Centre ring and dot.
  ctx.lineWidth = s * 0.03
  ctx.beginPath()
  ctx.arc(s / 2, s / 2, s * 0.11, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(s / 2, s / 2, s * 0.035, 0, Math.PI * 2)
  ctx.fill()
}

function makeTexture(glow) {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  drawPad(canvas.getContext('2d'), glow)
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

let shared = null
function getPadFace() {
  if (!shared) {
    const geometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
    const material = new MeshLambertMaterial({
      map: makeTexture(false),
      emissiveMap: makeTexture(true),
      emissive: new Color('#ffffff'),
      emissiveIntensity: 0.55,
      // Lies a hair above the pad's top: pull it forward in depth so it never flickers.
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    })
    shared = { geometry, material }
  }
  return shared
}

/** @param {{ pads: Array<{ x, z, top, size, color }> }} props */
export function PadFaces({ pads }) {
  const items = useMemo(
    () => pads.map((p) => ({ matrix: boxMatrix(p.x, p.top + 0.004, p.z, p.size - 0.16, 1, p.size - 0.16), color: p.color })),
    [pads],
  )
  const { geometry, material } = getPadFace()
  return <InstancedSet items={items} geometry={geometry} material={material} />
}

export default PadFaces
