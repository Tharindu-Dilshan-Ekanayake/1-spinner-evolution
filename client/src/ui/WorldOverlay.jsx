import { useEffect, useRef } from 'react'

import { mountOverlay, setOverlaySize, unmountOverlay } from '../game/overlay/worldOverlay'

/** Host element for the world-pinned labels (HP bars, names, popups). */
export default function WorldOverlay() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    mountOverlay(el)
    const resize = () => setOverlaySize(el.clientWidth, el.clientHeight)
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    return () => {
      observer.disconnect()
      unmountOverlay()
    }
  }, [])

  return <div ref={ref} className="pointer-events-none absolute inset-0 z-10 overflow-hidden" />
}
