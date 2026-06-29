import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import archiver from 'archiver'
import sharp from 'sharp'
import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { TARGETS } from '../shared/sizes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.join(__dirname, '..', 'output', 'export')
const DRAFTS_DIR = path.join(__dirname, '..', 'output', 'drafts')
const AUTOSAVE = '_autosave'

// filesystem-safe slug for the draft filename; original name is kept inside the JSON
function slug(name) {
  return String(name).trim().replace(/[^a-z0-9-_ ]/gi, '_').slice(0, 80) || 'untitled'
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '200mb' }))

const PORT = process.env.PORT || 3001

function decodeDataUrl(dataUrl) {
  const m = /^data:(.+?);base64,(.*)$/.exec(dataUrl)
  if (!m) throw new Error('bad data url')
  return Buffer.from(m[2], 'base64')
}

async function resizeTo(buf, target) {
  // cover-crop keeps content centered; safe-zone in the compositor protects the message.
  return sharp(buf)
    .resize(target.w, target.h, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer()
}

// POST /api/export { screenshots: [{ name, pngBase64 }], targetIds: [...] } -> zip stream
app.post('/api/export', async (req, res) => {
  try {
    // Each entry already carries its target id and a family-correct master PNG.
    const { screenshots } = req.body
    if (!screenshots?.length) return res.status(400).json({ error: 'no screenshots' })

    // fresh copy to <repo>/output/export so files are visible on disk
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true })

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', 'attachment; filename="appstore-screenshots.zip"')
    const zip = archiver('zip', { zlib: { level: 6 } })
    zip.on('error', (err) => res.status(500).end(String(err)))
    zip.pipe(res)

    let n = 0
    for (const entry of screenshots) {
      const t = TARGETS.find((x) => x.id === entry.targetId)
      if (!t) continue
      const src = decodeDataUrl(entry.pngBase64)
      const baseName = entry.name || `screenshot-${String(++n).padStart(2, '0')}`
      const out = await resizeTo(src, t) // same aspect as master → clean fit, no crop loss
      const rel = `${t.group}/${t.id}/${baseName}.png`
      zip.append(out, { name: rel })
      const dest = path.join(OUTPUT_DIR, rel)
      await fs.mkdir(path.dirname(dest), { recursive: true })
      await fs.writeFile(dest, out)
      n++
    }
    await zip.finalize()
    console.log(`exported ${n} image(s) -> ${OUTPUT_DIR}`)
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: String(e?.message || e) })
  }
})

// ---- Drafts (named saves) ----

// list saved drafts (newest first), excluding the autosave slot
app.get('/api/drafts', async (req, res) => {
  try {
    await fs.mkdir(DRAFTS_DIR, { recursive: true })
    const files = (await fs.readdir(DRAFTS_DIR)).filter((f) => f.endsWith('.json') && f !== `${AUTOSAVE}.json`)
    const list = []
    for (const f of files) {
      try {
        const j = JSON.parse(await fs.readFile(path.join(DRAFTS_DIR, f), 'utf8'))
        list.push({ name: j.name, savedAt: j.savedAt, screens: j.state?.shots?.length ?? 0 })
      } catch {}
    }
    list.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
    res.json({ drafts: list })
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
})

// load one draft by name (use AUTOSAVE for the autosave slot)
app.get('/api/drafts/:name', async (req, res) => {
  try {
    const file = path.join(DRAFTS_DIR, `${slug(req.params.name)}.json`)
    const j = JSON.parse(await fs.readFile(file, 'utf8'))
    res.json(j)
  } catch {
    res.status(404).json({ error: 'not found' })
  }
})

// save / overwrite a draft: { name, state }
app.put('/api/drafts/:name', async (req, res) => {
  try {
    await fs.mkdir(DRAFTS_DIR, { recursive: true })
    const name = req.params.name === AUTOSAVE ? AUTOSAVE : (req.body?.name || req.params.name)
    const file = path.join(DRAFTS_DIR, `${slug(req.params.name)}.json`)
    await fs.writeFile(file, JSON.stringify({ name, savedAt: Date.now(), state: req.body?.state ?? {} }))
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
})

app.delete('/api/drafts/:name', async (req, res) => {
  try {
    await fs.rm(path.join(DRAFTS_DIR, `${slug(req.params.name)}.json`), { force: true })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) })
  }
})

app.get('/api/health', (req, res) => res.json({ ok: true }))

app.listen(PORT, () => console.log(`server on http://localhost:${PORT}`))
