import React, { useEffect, useMemo, useRef, useState } from 'react'
import CanvasPreview from './components/CanvasPreview.jsx'
import BackgroundPicker from './components/BackgroundPicker.jsx'
import PopoutSelector from './components/PopoutSelector.jsx'
import DraftBar from './components/DraftBar.jsx'
import { renderMaster } from './lib/render.js'
import { TARGETS, DEFAULT_TARGET_IDS, groupFor, renderDimsFor } from '../shared/sizes.js'
import { FONTS, WEIGHTS, DEFAULT_FONT, ensureFont } from './lib/fonts.js'
import { exportZip, listDrafts, loadDraft, saveDraft, deleteDraft } from './lib/api.js'

const AUTOSAVE = '_autosave'

const DEFAULT_BG = { type: 'solid', color: '#16A34A' }

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
  const loadedRef = useRef(false)

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

  function setCount(n) {
    setShots((s) => {
      const next = [...s]
      while (next.length < n) next.push(newShot(next.length))
      next.length = n
      return next
    })
    if (active >= n) setActive(n - 1)
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

  const readyCount = useMemo(() => shots.filter((s) => s.imageUrl).length, [shots])

  // default vertical center of the pop-out: where the region sits on the card
  function autoCy(s) {
    const aspect = imageEl?.width ? imageEl.height / imageEl.width : 2.17
    const cardHFrac = 0.78 * (s.deviceScale ?? 1) * aspect * (1320 / 2868)
    const p = s.popout
    return (s.deviceTop ?? 0.3) + (p.sy + p.sh / 2) * cardHFrac
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>App Store Screenshot Generator</h1>
        <p className="sub">Upload a screen, add a heading, pick a background, optionally lift a region out as a pop-out, then export every size.</p>

        {error && <div className="banner">{error}</div>}

        <h2>Versions</h2>
        <DraftBar name={draftName} setName={setDraftName} drafts={drafts}
          onSave={onSaveDraft} onLoad={onLoadDraft} onDelete={onDeleteDraft} status={draftStatus} />

        <h2>Screenshots</h2>
        <label>How many? ({shots.length})</label>
        <input type="range" min="1" max="10" value={shots.length} onChange={(e) => setCount(Number(e.target.value))} style={{ width: '100%' }} />
        <div className="tabs">
          {shots.map((s, i) => (
            <div key={s.id} className={`tab ${i === active ? 'active' : ''}`} onClick={() => setActive(i)}>{i + 1}{s.imageUrl ? '' : ' ·'}</div>
          ))}
        </div>

        <h2>Screen {active + 1}</h2>
        <div className="dropzone" onClick={() => document.getElementById('file-in').click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onUpload(e.dataTransfer.files[0]) }}>
          {shot.imageUrl ? 'Replace screenshot' : 'Click or drop your app screenshot (PNG)'}
        </div>
        <input id="file-in" type="file" accept="image/*" hidden onChange={(e) => onUpload(e.target.files[0])} />

        <label>Heading (one word)</label>
        <input type="text" value={shot.heading} placeholder="SCORE" onChange={(e) => patch({ heading: e.target.value })} />
        <label>Heading size: {(shot.headingScale * 100).toFixed(0)}%</label>
        <input type="range" min="0.5" max="1.6" step="0.05" value={shot.headingScale} onChange={(e) => patch({ headingScale: Number(e.target.value) })} style={{ width: '100%' }} />

        <label>Subtext</label>
        <input type="text" value={shot.subtext} placeholder="EVERY SHOT LIVE" onChange={(e) => patch({ subtext: e.target.value })} />
        <label>Subtext size: {(shot.subScale * 100).toFixed(0)}%</label>
        <input type="range" min="0.5" max="3" step="0.05" value={shot.subScale} onChange={(e) => patch({ subScale: Number(e.target.value) })} style={{ width: '100%' }} />

        <label>Font</label>
        <select value={shot.fontFamily} onChange={(e) => patch({ fontFamily: e.target.value })}>
          {FONTS.map((f) => (
            <option key={f.name} value={f.name} style={{ fontFamily: f.stack }}>{f.name}</option>
          ))}
        </select>
        <div className="row" style={{ marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <label>Heading weight</label>
            <select value={shot.headingWeight} onChange={(e) => patch({ headingWeight: Number(e.target.value) })}>
              {WEIGHTS.map((w) => <option key={w.v} value={w.v}>{w.label}</option>)}
            </select>
          </div>
          <label className="check" style={{ marginTop: 22 }}>
            <input type="checkbox" checked={shot.headingItalic} onChange={(e) => patch({ headingItalic: e.target.checked })} /> Italic
          </label>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <label>Subtext weight</label>
            <select value={shot.subWeight} onChange={(e) => patch({ subWeight: Number(e.target.value) })}>
              {WEIGHTS.map((w) => <option key={w.v} value={w.v}>{w.label}</option>)}
            </select>
          </div>
          <label className="check" style={{ marginTop: 22 }}>
            <input type="checkbox" checked={shot.subItalic} onChange={(e) => patch({ subItalic: e.target.checked })} /> Italic
          </label>
        </div>

        <label>Heading position: {(shot.headingTop * 100).toFixed(0)}%</label>
        <input type="range" min="0.03" max="0.2" step="0.005" value={shot.headingTop} onChange={(e) => patch({ headingTop: Number(e.target.value) })} style={{ width: '100%' }} />
        <label>Screen position: {(shot.deviceTop * 100).toFixed(0)}%</label>
        <input type="range" min="0.18" max="0.55" step="0.01" value={shot.deviceTop} onChange={(e) => patch({ deviceTop: Number(e.target.value) })} style={{ width: '100%' }} />
        <label>Screen scale: {(shot.deviceScale * 100).toFixed(0)}%</label>
        <input type="range" min="0.6" max="1.2" step="0.02" value={shot.deviceScale} onChange={(e) => patch({ deviceScale: Number(e.target.value) })} style={{ width: '100%' }} />

        <h2>Pop-out</h2>
        <label className="check">
          <input type="checkbox" checked={shot.popout.enabled} onChange={(e) => patch({ popout: { ...shot.popout, enabled: e.target.checked } })} /> Enable cut-out pop-out
        </label>
        {shot.popout.enabled && (
          <>
            <p className="note">Drag the box over the area to lift out. Drag the corner to resize.</p>
            <PopoutSelector imageUrl={shot.imageUrl} region={shot.popout} onChange={(region) => patch({ popout: { ...shot.popout, ...region } })} />
            <label>Pop-out width: {((shot.popout.width ?? 0.92) * 100).toFixed(0)}%</label>
            <input type="range" min="0.4" max="1.1" step="0.02" value={shot.popout.width ?? 0.92} onChange={(e) => patch({ popout: { ...shot.popout, width: Number(e.target.value) } })} style={{ width: '100%' }} />
            <label>Pop-out vertical: {(((shot.popout.cy ?? autoCy(shot)) * 100)).toFixed(0)}%</label>
            <input type="range" min="0.2" max="0.95" step="0.01" value={shot.popout.cy ?? autoCy(shot)} onChange={(e) => patch({ popout: { ...shot.popout, cy: Number(e.target.value) } })} style={{ width: '100%' }} />
          </>
        )}

        <h2>Background (whole set)</h2>
        <BackgroundPicker background={background} onChange={setBackground} />

        <h2>Export sizes</h2>
        <div className="checks">
          {TARGETS.map((t) => (
            <label key={t.id} className="check">
              <input type="checkbox" checked={targetIds.includes(t.id)} onChange={() => toggleTarget(t.id)} />
              {t.label} — {t.w}×{t.h}{t.required ? ' ★' : ''}
            </label>
          ))}
        </div>
        <p className="note">Export saves to your browser's Downloads (zip) and to <code>output/export/</code> in the project.</p>
      </aside>

      <main className="stage">
        <div className="topbar">
          <strong>Screen {active + 1} / {shots.length}</strong>
          <span className="spacer" />
          <button className="primary" onClick={onExport} disabled={busy || readyCount === 0}>
            {busy ? 'Working…' : `Export ${readyCount} → zip`}
          </button>
        </div>

        <CanvasPreview shot={shot} background={background} imageEl={imageEl} />
      </main>
    </div>
  )
}
