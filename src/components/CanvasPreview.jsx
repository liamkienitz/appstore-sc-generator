import React, { useEffect, useRef } from 'react'
import { renderMaster } from '../lib/render.js'
import { ensureFont } from '../lib/fonts.js'

// Draws the master composition for one screenshot. If `enhancedUrl` is set,
// it shows that final image directly (already a full render) instead of the scaffold.
export default function CanvasPreview({ shot, background, imageEl, enhancedEl }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    if (enhancedEl && enhancedEl.width) {
      canvas.width = enhancedEl.width
      canvas.height = enhancedEl.height
      canvas.getContext('2d').drawImage(enhancedEl, 0, 0)
      return
    }
    let cancelled = false
    const draw = () => { if (!cancelled) renderMaster(canvas, { ...shot, background }, imageEl) }
    draw() // immediate paint (may use fallback font), then repaint once webfont is ready
    Promise.all([
      ensureFont(shot.fontFamily, shot.headingWeight, shot.headingItalic),
      ensureFont(shot.fontFamily, shot.subWeight, shot.subItalic),
    ]).then(draw)
    return () => { cancelled = true }
  }, [shot, background, imageEl, enhancedEl])

  return <canvas ref={ref} className="preview-canvas" />
}
