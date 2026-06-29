// Talk to the backend directly so export works whether the page is served by the
// vite dev server, `vite preview`, or an IDE preview pane (none of which may proxy /api).
// Override with VITE_API_BASE if you run the server on another host/port.
const API_BASE = import.meta.env?.VITE_API_BASE || 'http://localhost:3001'

async function jfetch(pathname, opts) {
  let res
  try {
    res = await fetch(`${API_BASE}${pathname}`, opts)
  } catch {
    throw new Error(`Can't reach the backend at ${API_BASE}. Is it running? Start everything with: npm run dev`)
  }
  if (!res.ok) {
    if (res.status === 404) return null
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `request failed (HTTP ${res.status})`)
  }
  return res.json()
}

export const listDrafts = () => jfetch('/api/drafts').then((d) => d?.drafts || [])
export const loadDraft = (name) => jfetch(`/api/drafts/${encodeURIComponent(name)}`)
export const saveDraft = (name, state) =>
  jfetch(`/api/drafts/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, state }),
  })
export const deleteDraft = (name) => jfetch(`/api/drafts/${encodeURIComponent(name)}`, { method: 'DELETE' })

export async function exportZip(screenshots, targetIds) {
  let res
  try {
    res = await fetch(`${API_BASE}/api/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screenshots, targetIds }),
    })
  } catch {
    throw new Error(`Can't reach the backend at ${API_BASE}. Is it running? Start everything with: npm run dev`)
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `export failed (HTTP ${res.status})`)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'appstore-screenshots.zip'
  a.click()
  URL.revokeObjectURL(url)
}
