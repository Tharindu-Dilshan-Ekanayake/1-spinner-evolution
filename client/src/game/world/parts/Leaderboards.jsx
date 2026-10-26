import { use, useEffect, useMemo } from 'react'

import { LEADERBOARD_POSITIONS, formatNumber } from '@shared'

import { useGameStore } from '../../../store/gameStore'
import { useQuality } from '../../../store/qualityStore'
import { createSignAtlas, drawText, fitSize, roundRect } from '../../render/signAtlas'
import { fontsReady } from './signStyles'

const COLORS = { playtime: '#ff4df0', rebirths: '#3ddc6a', wins: '#ffb321' }

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h ? `${h}h ${m}m` : `${m}m`
}

function drawBoard(board, rows) {
  return (ctx, w, h) => {
    roundRect(ctx, 0, 0, w, h, w * 0.04)
    ctx.fillStyle = '#1a1f3d'
    ctx.fill()
    roundRect(ctx, 0, 0, w, h * 0.13, w * 0.04)
    ctx.fillStyle = COLORS[board.id]
    ctx.fill()
    drawText(ctx, board.title, w / 2, h * 0.066, fitSize(ctx, board.title, h * 0.08, w * 0.9))
    const list = rows || []
    const rowH = (h * 0.84) / 10
    for (let i = 0; i < 10; i += 1) {
      const y = h * 0.16 + rowH * i + rowH / 2
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)'
        ctx.fillRect(w * 0.03, y - rowH / 2, w * 0.94, rowH)
      }
      const r = list[i]
      const medal = ['#ffd700', '#c9d3e0', '#e08a4a'][i] || '#ffffff'
      drawText(ctx, `#${i + 1}`, w * 0.1, y, rowH * 0.5, medal, '#000000')
      if (!r) continue
      const name = r.name.length > 14 ? `${r.name.slice(0, 13)}…` : r.name
      drawText(ctx, name, w * 0.19, y, rowH * 0.48, '#ffffff', '#000000', 'left')
      const value = board.id === 'playtime' ? formatTime(r.value) : formatNumber(r.value)
      drawText(ctx, value, w * 0.94, y, rowH * 0.48, COLORS[board.id], '#000000', 'right')
    }
  }
}

/** The three lobby leaderboards, redrawn whenever the server sends new rankings. */
export function Leaderboards() {
  use(fontsReady)
  const data = useGameStore((s) => s.leaderboards)
  // 512px on LOW (mobile texture budget), 1024px otherwise.
  const size = useQuality().textureSize >= 512 ? 1024 : 512

  const atlas = useMemo(() => {
    // Just in front of each board's frame, facing the way the board faces.
    const signs = LEADERBOARD_POSITIONS.map((b) => ({
      x: b.x + Math.sin(b.ry) * 0.32,
      y: 5.2,
      z: b.z + Math.cos(b.ry) * 0.32,
      ry: b.ry,
      w: 7.6,
      h: 9.2,
      draw: drawBoard(b, null),
    }))
    return createSignAtlas(signs, { atlasSize: size, density: size / 17 })
  }, [size])

  useEffect(() => () => atlas.dispose(), [atlas])

  useEffect(() => {
    if (!data) return
    atlas.redraw(
      LEADERBOARD_POSITIONS.map((b) => ({ draw: drawBoard(b, data[b.id]) })),
    )
  }, [data, atlas])

  return <primitive object={atlas.mesh} />
}
