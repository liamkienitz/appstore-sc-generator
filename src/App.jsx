import React, { useEffect, useRef, useState } from 'react'
import CanvasPreview from './components/CanvasPreview.jsx'
import BackgroundPicker from './components/BackgroundPicker.jsx'
import PopoutSelector from './components/PopoutSelector.jsx'
import DraftBar from './components/DraftBar.jsx'
import HowItWorks from './components/HowItWorks.jsx'
import { renderMaster } from './lib/render.js'
import { TARGETS, DEFAULT_TARGET_IDS, groupFor, renderDimsFor } from '../shared/sizes.js'
import { FONTS, WEIGHTS, DEFAULT_FONT, ensureFont } from './lib/fonts.js'
import { exportZip, listDrafts, loadDraft, saveDraft, deleteDraft } from './lib/api.js'

const AUTOSAVE = '_autosave'

const DEFAULT_BG = { type: 'solid', color: '#16A34A' }

const MAX_SHOTS = 10

function newShot(i) {
  return {
    id: crypto.randomUUID(),
    heading: '',
    subtext: '',
    imageUrl: null, // uploaded screenshot data url
    popout: { enabled: false, sx: 0.06, sy: 0.4, sw: 0.88, sh: 0.12, width: 0.92, cy: null },
    headingTop: 0.085,
    headingScale: 1.0,
    subScale: 1.0,
    fontFamily: DEFAULT_FONT,
    headingWeight: 800,
    headingItalic: false,
    subWeight: 700,
    subItalic: false,
    subNoWrap: false,
    deviceTop: 0.3,
    deviceScale: 1.0,
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    if (!url) return resolve(null)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

// Render a shot to a PNG data url at the given family dimensions (for export).
async function shotToScaffold(shot, background, dims) {
  const img = await loadImage(shot.imageUrl)
  await ensureFont(shot.fontFamily, shot.headingWeight, shot.headingItalic)
  await ensureFont(shot.fontFamily, shot.subWeight, shot.subItalic)
  const canvas = document.createElement('canvas')
  renderMaster(canvas, { ...shot, background }, img, dims)
  return canvas.toDataURL('image/png')
}

export default function App() {
  const [shots, setShots] = useState([newShot(0)])
  const [active, setActive] = useState(0)
  const [background, setBackground] = useState(DEFAULT_BG)
  const [targetIds, setTargetIds] = useState(DEFAULT_TARGET_IDS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [imageEl, setImageEl] = useState(null)
  const [drafts, setDrafts] = useState([])
  const [draftName, setDraftName] = useState('')
  const [draftStatus, setDraftStatus] = useState('')
  const [tab, setTab] = useState('content')
  const [showIntro, setShowIntro] = useState(() => !localStorage.getItem('ascgen:seen-intro'))
  const loadedRef = useRef(false)

  function dismissIntro() {
    localStorage.setItem('ascgen:seen-intro', '1')
    setShowIntro(false)
  }

  const shot = shots[active]

  // load the active shot's source image for the canvas
  useEffect(() => { loadImage(shot.imageUrl).then(setImageEl).catch(() => setImageEl(null)) }, [shot.imageUrl])

  const refreshDrafts = () => listDrafts().then(setDrafts).catch(() => {})

  const captureState = () => ({ shots, background, targetIds, active })
  function applyState(s) {
    if (!s) return
    if (Array.isArray(s.shots) && s.shots.length) setShots(s.shots)
    if (s.background) setBackground(s.background)
    if (Array.isArray(s.targetIds)) setTargetIds(s.targetIds)
    setActive(Math.min(s.active ?? 0, (s.shots?.length ?? 1) - 1))
  }

  // on mount: restore autosave (if any), then list named drafts
  useEffect(() => {
    (async () => {
      try {
        const auto = await loadDraft(AUTOSAVE)
        if (auto?.state) applyState(auto.state)
      } catch {}
      loadedRef.current = true
      refreshDrafts()
    })()
  }, [])

  // debounced autosave whenever the design changes
  useEffect(() => {
    if (!loadedRef.current) return
    const t = setTimeout(() => { saveDraft(AUTOSAVE, captureState()).catch(() => {}) }, 1000)
    return () => clearTimeout(t)
  }, [shots, background, targetIds, active])

  async function onSaveDraft() {
    const name = draftName.trim()
    if (!name) return
    try {
      await saveDraft(name, captureState())
      setDraftStatus(`Saved "${name}"`)
      refreshDrafts()
    } catch (e) {
      setDraftStatus(String(e.message || e))
    }
  }
  async function onLoadDraft(name) {
    try {
      const d = await loadDraft(name)
      applyState(d?.state)
      setDraftName(name)
      setDraftStatus(`Loaded "${name}"`)
    } catch (e) {
      setDraftStatus(String(e.message || e))
    }
  }
  async function onDeleteDraft(name) {
    try { await deleteDraft(name); refreshDrafts() } catch {}
  }

  function patch(p) {
    setShots((s) => s.map((sh, i) => (i === active ? { ...sh, ...p } : sh)))
  }

  function addScreen() {
    if (shots.length >= MAX_SHOTS) return
    setShots((s) => [...s, newShot(s.length)])
    setActive(shots.length)
  }

  function removeScreen(i) {
    if (shots.length <= 1) return
    setShots((s) => s.filter((_, idx) => idx !== i))
    setActive((a) => (a >= i ? Math.max(0, a - 1) : a))
  }

  function onUpload(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => patch({ imageUrl: reader.result })
    reader.readAsDataURL(file)
  }

  async function onExport() {
    setBusy(true); setError('')
    try {
      const payload = []
      for (let i = 0; i < shots.length; i++) {
        const s = shots[i]
        const name = `${String(i + 1).padStart(2, '0')}-${(s.heading || 'screen').toLowerCase()}`
        // render one master per aspect family this screen actually exports to
        const masters = {}
        for (const tid of targetIds) {
          const g = groupFor(tid)
          if (!masters[g]) masters[g] = await shotToScaffold(s, background, renderDimsFor(tid))
          payload.push({ name, targetId: tid, pngBase64: masters[g] })
        }
      }
      await exportZip(payload, targetIds)
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  function toggleTarget(id) {
    setTargetIds((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]))
  }

  // default vertical center of the pop-out: where the region sits on the card
  function autoCy(s) {
    const aspect = imageEl?.width ? imageEl.height / imageEl.width : 2.17
    const cardHFrac = 0.78 * (s.deviceScale ?? 1) * aspect * (1320 / 2868)
    const p = s.popout
    return (s.deviceTop ?? 0.3) + (p.sy + p.sh / 2) * cardHFrac
  }

  const TABS = [
    ['content', 'Content'],
    ['type', 'Type'],
    ['style', 'Style'],
    ['export', 'Export'],
    ['saves', 'Saves'],
  ]

  return (
    <div className="studio">
      {showIntro && <HowItWorks onClose={dismissIntro} />}
      {/* Top bar */}
      <div className="topbar">
        <span className="brand-name">Appstore SC Gen</span>
        <a className="brand-tag" href="https://liamkienitz.com" target="_blank" rel="noopener noreferrer">built by Liam Kienitz</a>
        <div className="topbar-right">
          <span className="screen-count">Screen {active + 1} / {shots.length}</span>
          <button className="export-btn" onClick={onExport} disabled={busy}>
            {busy ? 'Working…' : <>Export <span className="arrow">↓</span></>}
          </button>
        </div>
      </div>

      <div className="studio-body">
        {/* Screens rail */}
        <div className="rail">
          <span className="rail-label">SCREENS</span>
          {shots.map((s, i) => (
            <div key={s.id} className={`rail-pill ${i === active ? 'active' : ''}`} onClick={() => setActive(i)}>
              {i + 1}
              {shots.length > 1 && (
                <span className="rail-del" title="Remove screen"
                  onClick={(e) => { e.stopPropagation(); removeScreen(i) }}>×</span>
              )}
            </div>
          ))}
          {shots.length < MAX_SHOTS && (
            <div className="rail-add" onClick={addScreen}>+</div>
          )}
        </div>

        {/* Canvas */}
        <div className="canvas-stage">
          <div className="canvas-badge">{(shot.headingScale * 100).toFixed(0)}% · {shot.fontFamily}</div>
          <div className="canvas-scale">
            <CanvasPreview shot={shot} background={background} imageEl={imageEl} />
          </div>
        </div>

        {/* Inspector */}
        <div className="inspector">
          <div className="itabs">
            {TABS.map(([id, label]) => (
              <div key={id} className={`itab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</div>
            ))}
          </div>
          <div className="inspector-body">
            {error && <div className="banner">{error}</div>}

            {tab === 'content' && (
              <div className="stack">
                <div
                  className="dropzone"
                  onClick={() => document.getElementById('file-in').click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); onUpload(e.dataTransfer.files[0]) }}
                >
                  {shot.imageUrl ? 'Replace screenshot' : 'Click or drop your app screenshot (PNG)'}
                </div>
                <input id="file-in" type="file" accept="image/*" hidden onChange={(e) => onUpload(e.target.files[0])} />

                <div className="field">
                  <label>Heading (one word)</label>
                  <input type="text" value={shot.heading} placeholder="HEADLINE" onChange={(e) => patch({ heading: e.target.value })} />
                </div>
                <div className="field">
                  <label className="lbl-row"><span>Heading size</span><span className="val">{(shot.headingScale * 100).toFixed(0)}%</span></label>
                  <input type="range" min="0.5" max="1.6" step="0.05" value={shot.headingScale} onChange={(e) => patch({ headingScale: Number(e.target.value) })} />
                </div>
                <div className="field">
                  <label>Subtext</label>
                  <input type="text" value={shot.subtext} placeholder="Short description of this screen" onChange={(e) => patch({ subtext: e.target.value })} />
                </div>
                <div className="field">
                  <label className="lbl-row"><span>Subtext size</span><span className="val">{(shot.subScale * 100).toFixed(0)}%</span></label>
                  <input type="range" min="0.5" max="3" step="0.05" value={shot.subScale} onChange={(e) => patch({ subScale: Number(e.target.value) })} />
                </div>
                <label className="check">
                  <input type="checkbox" checked={shot.subNoWrap} onChange={(e) => patch({ subNoWrap: e.target.checked })} /> Don't wrap (shrink to one line)
                </label>
                <div className="field">
                  <label>Font</label>
                  <div className="select-wrap">
                    <select value={shot.fontFamily} onChange={(e) => patch({ fontFamily: e.target.value })}>
                      {FONTS.map((f) => (
                        <option key={f.name} value={f.name} style={{ fontFamily: f.stack }}>{f.name}</option>
                      ))}
                    </select>
                    <span className="select-caret">▾</span>
                  </div>
                </div>
              </div>
            )}

            {tab === 'type' && (
              <div className="stack">
                <div className="field">
                  <label>Heading weight</label>
                  <div className="row">
                    <div className="select-wrap" style={{ flex: 1 }}>
                      <select value={shot.headingWeight} onChange={(e) => patch({ headingWeight: Number(e.target.value) })}>
                        {WEIGHTS.map((w) => <option key={w.v} value={w.v}>{w.label}</option>)}
                      </select>
                      <span className="select-caret">▾</span>
                    </div>
                    <label className="check tight">
                      <input type="checkbox" checked={shot.headingItalic} onChange={(e) => patch({ headingItalic: e.target.checked })} /> Italic
                    </label>
                  </div>
                </div>
                <div className="field">
                  <label>Subtext weight</label>
                  <div className="row">
                    <div className="select-wrap" style={{ flex: 1 }}>
                      <select value={shot.subWeight} onChange={(e) => patch({ subWeight: Number(e.target.value) })}>
                        {WEIGHTS.map((w) => <option key={w.v} value={w.v}>{w.label}</option>)}
                      </select>
                      <span className="select-caret">▾</span>
                    </div>
                    <label className="check tight">
                      <input type="checkbox" checked={shot.subItalic} onChange={(e) => patch({ subItalic: e.target.checked })} /> Italic
                    </label>
                  </div>
                </div>
                <div className="field">
                  <label className="lbl-row"><span>Heading position</span><span className="val">{(shot.headingTop * 100).toFixed(0)}%</span></label>
                  <input type="range" min="0.03" max="0.2" step="0.005" value={shot.headingTop} onChange={(e) => patch({ headingTop: Number(e.target.value) })} />
                </div>
                <div className="field">
                  <label className="lbl-row"><span>Screen position</span><span className="val">{(shot.deviceTop * 100).toFixed(0)}%</span></label>
                  <input type="range" min="0.18" max="0.55" step="0.01" value={shot.deviceTop} onChange={(e) => patch({ deviceTop: Number(e.target.value) })} />
                </div>
                <div className="field">
                  <label className="lbl-row"><span>Screen scale</span><span className="val">{(shot.deviceScale * 100).toFixed(0)}%</span></label>
                  <input type="range" min="0.6" max="1.2" step="0.02" value={shot.deviceScale} onChange={(e) => patch({ deviceScale: Number(e.target.value) })} />
                </div>
              </div>
            )}

            {tab === 'style' && (
              <div className="stack">
                <div className="field">
                  <label>Background (whole set)</label>
                  <BackgroundPicker background={background} onChange={setBackground} />
                </div>
                <label className="check">
                  <input type="checkbox" checked={shot.popout.enabled} onChange={(e) => patch({ popout: { ...shot.popout, enabled: e.target.checked } })} /> Enable cut-out pop-out
                </label>
                {shot.popout.enabled && (
                  <>
                    <p className="note">Drag the box over the area to lift out. Drag the corner to resize.</p>
                    <PopoutSelector imageUrl={shot.imageUrl} region={shot.popout} onChange={(region) => patch({ popout: { ...shot.popout, ...region } })} />
                    <div className="field">
                      <label className="lbl-row"><span>Pop-out width</span><span className="val">{((shot.popout.width ?? 0.92) * 100).toFixed(0)}%</span></label>
                      <input type="range" min="0.4" max="1.1" step="0.02" value={shot.popout.width ?? 0.92} onChange={(e) => patch({ popout: { ...shot.popout, width: Number(e.target.value) } })} />
                    </div>
                    <div className="field">
                      <label className="lbl-row"><span>Pop-out vertical</span><span className="val">{(((shot.popout.cy ?? autoCy(shot)) * 100)).toFixed(0)}%</span></label>
                      <input type="range" min="0.2" max="0.95" step="0.01" value={shot.popout.cy ?? autoCy(shot)} onChange={(e) => patch({ popout: { ...shot.popout, cy: Number(e.target.value) } })} />
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === 'export' && (
              <div className="stack">
                <label className="section-label">Export sizes</label>
                <div className="checks">
                  {TARGETS.map((t) => (
                    <label key={t.id} className="check">
                      <input type="checkbox" checked={targetIds.includes(t.id)} onChange={() => toggleTarget(t.id)} />
                      <span style={{ flex: 1 }}>{t.label}{t.required ? ' ★' : ''}</span>
                      <span className="dim">{t.w}×{t.h}</span>
                    </label>
                  ))}
                </div>
                <p className="note">Export builds a zip in your browser and downloads it — every selected size, rendered locally.</p>
              </div>
            )}

            {tab === 'saves' && (
              <div className="stack">
                <DraftBar name={draftName} setName={setDraftName} drafts={drafts}
                  onSave={onSaveDraft} onLoad={onLoadDraft} onDelete={onDeleteDraft} status={draftStatus} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
