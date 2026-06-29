import React from 'react'

function ago(ts) {
  if (!ts) return ''
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function DraftBar({ name, setName, drafts, onSave, onLoad, onDelete, status }) {
  return (
    <div>
      <div className="row">
        <input type="text" value={name} placeholder="Version name…" onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSave() }} style={{ flex: 1 }} />
        <button className="primary" onClick={onSave} disabled={!name.trim()}>Save</button>
      </div>
      {status && <p className="note">{status}</p>}

      {drafts.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {drafts.map((d) => (
            <div key={d.name} className="draft">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="draft-name">{d.name}</div>
                <div className="note" style={{ margin: 0 }}>{d.screens} screen{d.screens === 1 ? '' : 's'} · {ago(d.savedAt)}</div>
              </div>
              <button onClick={() => onLoad(d.name)}>Load</button>
              <button onClick={() => onDelete(d.name)} title="Delete" style={{ color: 'var(--danger)' }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
