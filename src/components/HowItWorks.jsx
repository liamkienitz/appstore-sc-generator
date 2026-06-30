import React from 'react'

const STEPS = [
  ['Upload', 'Drop your app screenshot (PNG) into the Content tab — one per screen.'],
  ['Caption', 'Add a heading and subtext, then tune type, position, and background.'],
  ['Pop-out', 'Optionally lift a region out of the screen for a 3D highlight effect.'],
  ['Export', 'Pick your store sizes and hit Export — a zip is built and downloaded right in your browser.'],
]

export default function HowItWorks({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-spark">✦</div>
        <h2 className="modal-title">Welcome to Appstore SC Gen</h2>
        <p className="modal-sub">Make polished App Store / Play screenshots in four steps — all client-side, nothing leaves your browser.</p>
        <ol className="modal-steps">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="modal-step">
              <span className="modal-step-num">{i + 1}</span>
              <div>
                <strong>{title}</strong>
                <span>{body}</span>
              </div>
            </li>
          ))}
        </ol>
        <button className="modal-cta" onClick={onClose}>Get started</button>
      </div>
    </div>
  )
}
