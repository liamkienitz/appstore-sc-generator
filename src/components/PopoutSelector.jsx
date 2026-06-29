import React, { useRef, useState } from 'react'

// Drag the box to move, drag the corner to resize. Emits region as fractions
// (sx, sy, sw, sh) of the natural screenshot, consumed by render.js drawPopout.
export default function PopoutSelector({ imageUrl, region, onChange, width = 300 }) {
  const wrapRef = useRef(null)
  const [drag, setDrag] = useState(null)

  if (!imageUrl) return <p className="note">Upload a screenshot to pick a pop-out region.</p>

  const r = region || { sx: 0.06, sy: 0.4, sw: 0.88, sh: 0.12 }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

  function onDown(e, mode) {
    e.preventDefault()
    e.stopPropagation()
    const rect = wrapRef.current.getBoundingClientRect()
    setDrag({ mode, startX: e.clientX, startY: e.clientY, rect, orig: { ...r } })
  }

  function onMove(e) {
    if (!drag) return
    const { rect, orig, mode } = drag
    const dx = (e.clientX - drag.startX) / rect.width
    const dy = (e.clientY - drag.startY) / rect.height
    if (mode === 'move') {
      onChange({ ...orig, sx: clamp(orig.sx + dx, 0, 1 - orig.sw), sy: clamp(orig.sy + dy, 0, 1 - orig.sh) })
    } else {
      onChange({ ...orig, sw: clamp(orig.sw + dx, 0.05, 1 - orig.sx), sh: clamp(orig.sh + dy, 0.03, 1 - orig.sy) })
    }
  }

  function onUp() { setDrag(null) }

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', width, userSelect: 'none', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
    >
      <img src={imageUrl} alt="screenshot" style={{ width: '100%', display: 'block', pointerEvents: 'none' }} />
      <div
        onPointerDown={(e) => onDown(e, 'move')}
        style={{
          position: 'absolute',
          left: `${r.sx * 100}%`, top: `${r.sy * 100}%`,
          width: `${r.sw * 100}%`, height: `${r.sh * 100}%`,
          border: '2px solid #22c55e', background: 'rgba(34,197,94,0.18)',
          cursor: 'move', boxSizing: 'border-box',
        }}
      >
        <div
          onPointerDown={(e) => onDown(e, 'resize')}
          style={{
            position: 'absolute', right: -7, bottom: -7, width: 14, height: 14,
            background: '#22c55e', border: '2px solid #fff', borderRadius: 3, cursor: 'nwse-resize',
          }}
        />
      </div>
    </div>
  )
}
