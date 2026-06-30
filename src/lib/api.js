// Fully client-side: no backend. Drafts live in localStorage; export resizes
// each master in a <canvas> and zips with JSZip — so the app deploys as a pure
// static site (e.g. Cloudflare Pages) with nothing to run server-side.
import JSZip from 'jszip'
import { TARGETS } from '../../shared/sizes.js'

// ---- Drafts (localStorage) ----
const DRAFT_PREFIX = 'ascgen:draft:'
const AUTOSAVE = '_autosave'

function draftKey(name) { return DRAFT_PREFIX + name }

export async function listDrafts() {
  const out = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k || !k.startsWith(DRAFT_PREFIX)) continue
    const name = k.slice(DRAFT_PREFIX.length)
    if (name === AUTOSAVE) continue
    try {
      const j = JSON.parse(localStorage.getItem(k))
      out.push({ name: j.name ?? name, savedAt: j.savedAt, screens: j.state?.shots?.length ?? 0 })
    } catch {}
  }
  out.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
  return out
}

export async function loadDraft(name) {
  const raw = localStorage.getItem(draftKey(name))
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export async function saveDraft(name, state) {
  const rec = { name, savedAt: Date.now(), state }
  try {
    localStorage.setItem(draftKey(name), JSON.stringify(rec))
  } catch (e) {
    throw new Error("Couldn't save — browser storage is full. Delete some drafts and try again.")
  }
  return { ok: true }
}

export async function deleteDraft(name) {
  localStorage.removeItem(draftKey(name))
  return { ok: true }
}

// ---- Export (canvas resize + JSZip, downloaded in-browser) ----

function loadImg(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataUrl
  })
}

// Master already matches its target family's aspect ratio, so this is a clean
// scale to the exact output dimensions — no crop, same result sharp produced.
async function resizeToPng(dataUrl, w, h) {
  const img = await loadImg(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'))
  return blob
}

// screenshots: [{ name, targetId, pngBase64 }] — same shape App already builds.
export async function exportZip(screenshots) {
  if (!screenshots?.length) throw new Error('no screenshots')
  const zip = new JSZip()
  let n = 0
  for (const entry of screenshots) {
    const t = TARGETS.find((x) => x.id === entry.targetId)
    if (!t) continue
    const baseName = entry.name || `screenshot-${String(n + 1).padStart(2, '0')}`
    const blob = await resizeToPng(entry.pngBase64, t.w, t.h)
    zip.file(`${t.group}/${t.id}/${baseName}.png`, blob)
    n++
  }
  const out = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  const url = URL.createObjectURL(out)
  const a = document.createElement('a')
  a.href = url
  a.download = 'appstore-screenshots.zip'
  a.click()
  URL.revokeObjectURL(url)
}
