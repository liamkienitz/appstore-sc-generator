// Test-only scaffold builder (mirrors src/lib/render.js) so we can validate the
// compose -> Gemini -> export pipeline from the CLI without a browser.
import sharp from 'sharp'
import { MASTER, SAFE } from '../shared/sizes.js'

const [, , screenshotPath, heading, subtext, bgColor, outPath] = process.argv
const W = Number(process.env.RW) || MASTER.w
const H = Number(process.env.RH) || MASTER.h
const safeW = SAFE.w * W

const meta = await sharp(screenshotPath).metadata()
const aspect = meta.height / meta.width
const cardW = Math.round(safeW * 1.0)
const cardH = Math.round(cardW * aspect)
const cardX = Math.round((W - cardW) / 2)
const cardTop = Math.round(0.3 * H)
const radius = Math.round(cardW * 0.09)

// rounded screenshot (clamp height to canvas — the browser canvas just clips the bleed)
const visH = Math.min(cardH, H - cardTop)
const roundedFull = await sharp(await sharp(screenshotPath).resize(cardW, cardH, { fit: 'fill' }).png().toBuffer())
  .composite([{ input: Buffer.from(`<svg><rect x="0" y="0" width="${cardW}" height="${cardH}" rx="${radius}" ry="${radius}"/></svg>`), blend: 'dest-in' }])
  .png().toBuffer()
const rounded = visH < cardH
  ? await sharp(roundedFull).extract({ left: 0, top: 0, width: cardW, height: visH }).png().toBuffer()
  : roundedFull

// auto-fit heading size
function fit(text, weight, maxW, start, min) {
  // rough advance-width estimate for Helvetica-like bold caps
  const factor = weight >= 800 ? 0.62 : 0.58
  let s = start
  while (s > min && text.length * s * factor > maxW) s -= 4
  return s
}
const subScale = Number(process.argv[7] || 1)
const subWords = subtext.toUpperCase().split(' ')
const longest = subWords.reduce((a, b) => (a.length >= b.length ? a : b), '')
const hSize = fit(heading.toUpperCase(), 800, safeW, 230, 90)
const sSize = fit(longest, 700, safeW, Math.round(130 * subScale), 32)
const hy = Math.round(0.085 * H + hSize)

const subLines = []
let line = ''
for (const w of subWords) {
  const t = line ? `${line} ${w}` : w
  if (t.length * sSize * 0.58 > safeW && line) { subLines.push(line); line = w }
  else line = t
}
if (line) subLines.push(line)

let sy = hy + sSize * 0.55
const subTspans = subLines.map((ln) => { sy += sSize * 1.05; return `<text x="${W / 2}" y="${Math.round(sy)}" font-size="${sSize}" font-weight="700" text-anchor="middle">${ln}</text>` }).join('')

const textSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <style>text{font-family:'Helvetica Neue',Arial,sans-serif;fill:#fff;}</style>
  <text x="${W / 2}" y="${hy}" font-size="${hSize}" font-weight="800" text-anchor="middle">${heading.toUpperCase()}</text>
  ${subTspans}
</svg>`

// soft shadow plate behind card
const shadow = `<svg width="${W}" height="${H}"><defs><filter id="b"><feGaussianBlur stdDeviation="40"/></filter></defs>
  <rect x="${cardX}" y="${cardTop + 20}" width="${cardW}" height="${cardH}" rx="${radius}" fill="rgba(0,0,0,0.35)" filter="url(#b)"/></svg>`

const layers = [
  { input: Buffer.from(shadow), top: 0, left: 0 },
  { input: rounded, top: cardTop, left: cardX },
  { input: Buffer.from(textSvg), top: 0, left: 0 },
]

// optional native pop-out: argv[8] = "sx,sy,sw,sh,width,cy" (mirrors render.js drawPopout)
if (process.argv[8]) {
  const [psx, psy, psw, psh, pwf, pcy] = process.argv[8].split(',').map(Number)
  const iw = meta.width, ih = meta.height
  const sx = Math.round(psx * iw), sy0 = Math.round(psy * ih), sw = Math.round(psw * iw), sh = Math.round(psh * ih)
  const margin = W * 0.03
  let pad0 = (pwf || 0.92) * W * 0.02
  let pw = (pwf || 0.92) * W
  let ph = pw * (sh / sw)
  let frameW = pw, frameH = ph + pad0 * 2
  const fit = Math.min(1, (W - margin * 2) / frameW, (H - margin * 2) / frameH)
  if (fit < 1) { pw *= fit; ph *= fit; pad0 *= fit; frameW = pw; frameH = ph + pad0 * 2 }
  pw = Math.round(pw); ph = Math.round(ph); const pad = Math.round(pad0); frameW = Math.round(frameW); frameH = Math.round(ph + pad * 2)
  const pr = Math.round(pw * 0.045)
  const px = Math.round((W - frameW) / 2)
  const cyFrac = pcy || (cardTop + (psy + psh / 2) * cardH) / H
  let py = Math.round(cyFrac * H - frameH / 2)
  py = Math.max(Math.round(margin), Math.min(py, Math.round(H - frameH - margin)))

  const crop = await sharp(screenshotPath).extract({ left: sx, top: sy0, width: sw, height: sh })
    .resize(pw - pad * 2, ph, { fit: 'fill' }).png().toBuffer()
  const innerR = Math.round(pr * 0.7)
  const cropRounded = await sharp(crop).composite([{ input: Buffer.from(`<svg><rect width="${pw - pad * 2}" height="${ph}" rx="${innerR}" ry="${innerR}"/></svg>`), blend: 'dest-in' }]).png().toBuffer()
  const frame = await sharp({ create: { width: frameW, height: frameH, channels: 4, background: '#ffffff' } })
    .composite([{ input: Buffer.from(`<svg><rect width="${frameW}" height="${frameH}" rx="${pr}" ry="${pr}"/></svg>`), blend: 'dest-in' }, { input: cropRounded, top: pad, left: pad }])
    .png().toBuffer()
  const popShadow = `<svg width="${W}" height="${H}"><defs><filter id="p"><feGaussianBlur stdDeviation="${Math.round(pw * 0.03)}"/></filter></defs>
    <rect x="${px}" y="${py + Math.round(pw * 0.02)}" width="${frameW}" height="${frameH}" rx="${pr}" fill="rgba(0,0,0,0.35)" filter="url(#p)"/></svg>`
  layers.push({ input: Buffer.from(popShadow), top: 0, left: 0 })
  layers.push({ input: frame, top: py, left: px })
}

await sharp({ create: { width: W, height: H, channels: 4, background: bgColor } })
  .composite(layers)
  .png()
  .toFile(outPath)

console.log('wrote', outPath, `${W}x${H}`, 'card', `${cardW}x${cardH}`)
