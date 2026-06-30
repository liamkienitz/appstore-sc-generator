import { MASTER, SAFE } from '../../shared/sizes.js'
import { fontStack } from './fonts.js'

// Background fill: solid color or linear gradient.
function paintBackground(ctx, bg, dims) {
  const { w, h } = dims
  if (bg.type === 'gradient') {
    const ang = ((bg.angle ?? 135) * Math.PI) / 180
    // Project the gradient line across the full canvas for the given angle.
    const cx = w / 2
    const cy = h / 2
    const len = Math.abs(w * Math.cos(ang)) + Math.abs(h * Math.sin(ang))
    const dx = (Math.cos(ang) * len) / 2
    const dy = (Math.sin(ang) * len) / 2
    const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy)
    const stops = bg.stops?.length ? bg.stops : [{ pos: 0, color: '#16A34A' }, { pos: 1, color: '#065F46' }]
    for (const s of stops) g.addColorStop(Math.min(1, Math.max(0, s.pos)), s.color)
    ctx.fillStyle = g
  } else {
    ctx.fillStyle = bg.color || '#16A34A'
  }
  ctx.fillRect(0, 0, w, h)
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

// Fit a single line to a max width by shrinking from a starting size.
// `face` is a prebuilt font spec sans size: `${italic} ${weight} ${stack}`.
function fitFont(ctx, text, face, maxWidth, startPx, minPx) {
  let size = startPx
  while (size > minPx) {
    ctx.font = `${face.replace('SIZE', size)}`
    if (ctx.measureText(text).width <= maxWidth) break
    size -= 4
  }
  return size
}

function faceSpec(name, weight, italic) {
  return `${italic ? 'italic ' : ''}${weight} SIZEpx ${fontStack(name)}`
}

// Draw the whole composition at the given dimensions (defaults to the iPhone master).
// Rendering at the target's own aspect — instead of cropping one master — keeps the
// headline and screenshot fully visible on every device family (iPhone / iPad / Android).
export function renderMaster(canvas, opts, screenshotImg, dims = MASTER) {
  const { w, h } = dims
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, w, h)

  paintBackground(ctx, opts.background, dims)

  const safeX = SAFE.x * w
  const safeW = SAFE.w * w
  const textColor = opts.textColor || '#FFFFFF'

  // --- Heading (one big word) ---
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = textColor
  const cx = w / 2
  let y = h * (opts.headingTop ?? 0.085)

  const fam = opts.fontFamily || 'Helvetica Neue'
  const headFace = faceSpec(fam, opts.headingWeight ?? 800, opts.headingItalic)
  const subFace = faceSpec(opts.subFontFamily || fam, opts.subWeight ?? 700, opts.subItalic)

  const heading = (opts.heading || '').toUpperCase()
  if (heading) {
    // headingScale sets the target size; it still shrinks to stay inside the safe width.
    const size = fitFont(ctx, heading, headFace, safeW, Math.round(230 * (opts.headingScale ?? 1)), 40)
    ctx.font = headFace.replace('SIZE', size)
    y += size
    ctx.fillText(heading, cx, y)
  }

  // --- Subtext (wraps to 2 lines, or shrinks to one line when noWrap) ---
  const sub = (opts.subtext || '').toUpperCase()
  if (sub) {
    const words = sub.split(' ')
    let lines
    let subSize
    if (opts.subNoWrap) {
      // Force a single line: shrink the whole phrase to fit the safe width.
      // This keeps narrower targets (Android 9:16, iPad) on one line instead of
      // wrapping a phrase that fit on one line at the iPhone master width.
      subSize = fitFont(ctx, sub, subFace, safeW, Math.round(130 * (opts.subScale ?? 1)), 20)
      ctx.font = subFace.replace('SIZE', subSize)
      lines = [sub]
    } else {
      // Size by the longest single word so the subtext can grow large and wrap,
      // instead of being clamped to fit the whole line at once.
      const longest = words.reduce((a, b) => (a.length >= b.length ? a : b), '')
      subSize = fitFont(ctx, longest, subFace, safeW, Math.round(130 * (opts.subScale ?? 1)), 32)
      ctx.font = subFace.replace('SIZE', subSize)
      lines = []
      let line = ''
      for (const word of words) {
        const test = line ? `${line} ${word}` : word
        if (ctx.measureText(test).width > safeW && line) {
          lines.push(line)
          line = word
        } else line = test
      }
      if (line) lines.push(line)
    }
    y += subSize * 0.55
    for (const ln of lines) {
      y += subSize * 1.05
      ctx.fillText(ln, cx, y)
    }
  }

  // --- Screenshot card (positioned high, bottom bleeds off canvas) ---
  if (screenshotImg && screenshotImg.width) {
    // start below the actual text bottom (`y`) so heading/subtext are never covered,
    // which matters on shorter canvases (Android 9:16, iPad) where the text block
    // would otherwise collide with a fixed-fraction card position.
    const cardTop = Math.max(h * (opts.deviceTop ?? 0.3), y + h * 0.025)
    const cardW = safeW * (opts.deviceScale ?? 1.0)
    const aspect = screenshotImg.height / screenshotImg.width
    const cardH = cardW * aspect
    const cardX = (w - cardW) / 2
    const radius = cardW * 0.09

    // drop shadow under the card
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.32)'
    ctx.shadowBlur = cardW * 0.06
    ctx.shadowOffsetY = cardW * 0.03
    roundRectPath(ctx, cardX, cardTop, cardW, cardH, radius)
    ctx.fillStyle = '#000'
    ctx.fill()
    ctx.restore()

    // clip + draw screenshot
    ctx.save()
    roundRectPath(ctx, cardX, cardTop, cardW, cardH, radius)
    ctx.clip()
    ctx.drawImage(screenshotImg, cardX, cardTop, cardW, cardH)
    ctx.restore()

    drawPopout(ctx, opts.popout, screenshotImg, { cardTop, cardH }, dims)
  }

  return ctx
}

// Native "pop out": crop a region of the screenshot and render it enlarged,
// centered, with a white frame + drop shadow floating over the card.
function drawPopout(ctx, p, img, card, dims) {
  if (!p?.enabled || !img?.width || !p.sw || !p.sh) return
  const { w, h } = dims
  const sx = p.sx * img.width
  const sy = p.sy * img.height
  const sw = p.sw * img.width
  const sh = p.sh * img.height

  const margin = w * 0.03
  let pad = (p.width ?? 0.92) * w * 0.02
  let pw = (p.width ?? 0.92) * w
  let ph = pw * (sh / sw)
  let frameW = pw
  let frameH = ph + pad * 2

  // auto-fit: shrink so the whole white frame fits within the canvas (both axes)
  const maxW = w - margin * 2
  const maxH = h - margin * 2
  const fit = Math.min(1, maxW / frameW, maxH / frameH)
  if (fit < 1) { pw *= fit; ph *= fit; pad *= fit; frameW = pw; frameH = ph + pad * 2 }

  const r = pw * 0.045
  const px = (w - frameW) / 2
  // default vertical center tracks where the region sits on the card, then clamp on-canvas
  const cy = p.cy ?? (card.cardTop + (p.sy + p.sh / 2) * card.cardH) / h
  let py = cy * h - frameH / 2
  py = Math.max(margin, Math.min(py, h - frameH - margin))

  // white frame + shadow
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = pw * 0.05
  ctx.shadowOffsetY = pw * 0.02
  roundRectPath(ctx, px, py, frameW, frameH, r)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.restore()

  // cropped region, inset inside the white frame
  ctx.save()
  roundRectPath(ctx, px + pad, py + pad, pw - pad * 2, ph, r * 0.7)
  ctx.clip()
  ctx.drawImage(img, sx, sy, sw, sh, px + pad, py + pad, pw - pad * 2, ph)
  ctx.restore()
}
