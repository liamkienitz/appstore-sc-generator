import React from 'react'

const STEPS = [
  ['Upload', 'Drop your app screenshot (PNG) into the Content tab, one per screen.'],
  ['Caption', 'Add a heading and subtext, then tune type, position, and background.'],
  ['Pop-out', 'Optionally lift a region out of the screen for a 3D highlight effect.'],
  ['Export', 'Pick your store sizes and hit Export. A zip is built and downloaded right in your browser.'],
]

export default function HowItWorks({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-spark">
          <svg viewBox="0 0 32 32" width="46" height="46" aria-hidden="true">
            <rect width="32" height="32" rx="9" fill="url(#mg)" />
            <defs>
              <linearGradient id="mg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#6366f1" />
                <stop offset="1" stopColor="#4338ca" />
              </linearGradient>
            </defs>
            <path fill="#fff" d="M16 5c.6 4.3 1.7 5.4 6 6-4.3.6-5.4 1.7-6 6-.6-4.3-1.7-5.4-6-6 4.3-.6 5.4-1.7 6-6z" />
            <path fill="#fff" opacity=".85" d="M24.5 18c.3 2 .8 2.5 2.8 2.8-2 .3-2.5.8-2.8 2.7-.3-2-.8-2.4-2.7-2.7 2-.3 2.4-.8 2.7-2.8z" />
          </svg>
        </div>
        <h2 className="modal-title">Welcome to Appstore SC Gen</h2>
        <p className="modal-sub">Make polished App Store / Play screenshots in four steps. All client-side, nothing leaves your browser.</p>
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
