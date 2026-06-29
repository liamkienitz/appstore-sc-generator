import React from 'react'

const SOLIDS = ['#16A34A', '#0EA5E9', '#7C3AED', '#DB2777', '#F97316', '#EAB308', '#111827', '#DC2626']
const GRADIENTS = [
  { stops: [{ pos: 0, color: '#22C55E' }, { pos: 1, color: '#065F46' }], angle: 135 },
  { stops: [{ pos: 0, color: '#38BDF8' }, { pos: 1, color: '#1E3A8A' }], angle: 135 },
  { stops: [{ pos: 0, color: '#A78BFA' }, { pos: 1, color: '#5B21B6' }], angle: 135 },
  { stops: [{ pos: 0, color: '#FB7185' }, { pos: 1, color: '#9D174D' }], angle: 135 },
  { stops: [{ pos: 0, color: '#FBBF24' }, { pos: 1, color: '#B45309' }], angle: 135 },
]

function gradCss(g) {
  return `linear-gradient(${g.angle}deg, ${g.stops.map((s) => `${s.color} ${s.pos * 100}%`).join(', ')})`
}

export default function BackgroundPicker({ background, onChange }) {
  const isGrad = background.type === 'gradient'
  return (
    <div>
      <div className="tabs">
        <div className={`tab ${!isGrad ? 'active' : ''}`} onClick={() => onChange({ type: 'solid', color: background.color || '#16A34A' })}>Solid</div>
        <div className={`tab ${isGrad ? 'active' : ''}`} onClick={() => onChange({ type: 'gradient', angle: 135, stops: GRADIENTS[0].stops })}>Gradient</div>
      </div>

      {!isGrad && (
        <>
          <div className="swatches">
            {SOLIDS.map((c) => (
              <div key={c} className={`swatch ${background.color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => onChange({ type: 'solid', color: c })} />
            ))}
          </div>
          <label>Custom color</label>
          <input type="color" value={background.color || '#16A34A'} onChange={(e) => onChange({ type: 'solid', color: e.target.value })} style={{ width: 60, height: 34, padding: 2 }} />
        </>
      )}

      {isGrad && (
        <>
          <div className="swatches">
            {GRADIENTS.map((g, i) => (
              <div key={i} className="swatch" style={{ background: gradCss(g), width: 44 }} onClick={() => onChange({ type: 'gradient', angle: g.angle, stops: g.stops })} />
            ))}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <div style={{ flex: 1 }}>
              <label>Start</label>
              <input type="color" value={background.stops?.[0]?.color || '#22C55E'} onChange={(e) => onChange({ ...background, stops: [{ pos: 0, color: e.target.value }, background.stops?.[1] || { pos: 1, color: '#065F46' }] })} style={{ width: 60, height: 34, padding: 2 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label>End</label>
              <input type="color" value={background.stops?.[1]?.color || '#065F46'} onChange={(e) => onChange({ ...background, stops: [background.stops?.[0] || { pos: 0, color: '#22C55E' }, { pos: 1, color: e.target.value }] })} style={{ width: 60, height: 34, padding: 2 }} />
            </div>
          </div>
          <label>Angle: {background.angle ?? 135}°</label>
          <input type="range" min="0" max="360" value={background.angle ?? 135} onChange={(e) => onChange({ ...background, angle: Number(e.target.value) })} style={{ width: '100%' }} />
        </>
      )}
    </div>
  )
}
