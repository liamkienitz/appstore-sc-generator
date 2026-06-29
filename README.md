# App Store Screenshot Generator

Local web app to turn your own app screenshots into high-converting App Store / Google Play marketing screenshots — bold heading + subtext over a solid or gradient background, an optional **native cut-out pop-out** (lift a region out, enlarged, white-framed with a shadow), then one-click export to every required iOS + Android size.

No device-frame rendering and no AI — you supply the screenshot, the tool frames and dresses it deterministically. What you see in the preview is exactly what exports.

![showcase](output/showcase.png)

## Setup

```bash
npm install
npm run dev                 # client http://localhost:5173  · server http://localhost:3001
```

No API key needed. (The server is just the `sharp` resize/zip backend.)

## Versions / drafts

- Your work **autosaves** continuously — reload or restart and it comes back.
- Save **named versions** ("Versions" panel, top of the sidebar) to keep multiple variants; Load or delete any of them later.
- All drafts are JSON files in `output/drafts/` (the autosave is `_autosave.json`, hidden from the list). Delete the folder to wipe everything.

## How to use

1. **How many?** — slider, 1–10 screenshots.
2. Per screen: **drop your app screenshot**, type a one-word **Heading** (e.g. `SCORE`) and **Subtext** (e.g. `EVERY SHOT LIVE`).
3. Set **font, weight, italic, sizes**, and nudge **heading / screen position / scale**. A safe-zone keeps text clear of crop edges.
4. **Pop-out** (optional): tick *Enable*, then drag the green box over the region you want to lift out (e.g. a score row), drag the corner to resize. Tune its **width** and **vertical** position. It renders enlarged, white-framed, with a drop shadow, floating beyond the card edges.
5. Pick a **Background** for the whole set — solid swatch, custom color, or gradient (angle + 2 stops).
6. **Export** — pick sizes, click Export. You get a `appstore-screenshots.zip` in your browser's Downloads **and** the same files written to `output/export/` in the project (cleared & rewritten each export). Each screen is cropped/resized to exact store dimensions, foldered by platform.

## Output sizes

| Platform | Size (px) | Notes |
|---|---|---|
| iPhone 6.9" | 1320 × 2868 | ★ App Store Connect primary |
| iPhone 6.7" | 1290 × 2796 | |
| iPhone 6.5" | 1242 × 2688 | |
| iPad 13" | 2064 × 2752 | |
| iPad 12.9" | 2048 × 2732 | |
| Android phone | 1080 × 1920 | ★ Google Play |
| Android 7" tablet | 1206 × 2144 | |
| Android 10" tablet | 1449 × 2576 | |

iOS art is reused for Android via center cover-crop. Apple's iPhone ratio (~0.46) is narrower than Android 9:16, so the compositor keeps all text/content inside a center safe zone — nothing important is clipped on any target. Legacy iPhone sizes (5.5"/4.7"/4"/3.5") are intentionally excluded — App Store Connect no longer accepts them for new apps.

## How it works

`compose → export`

- **compose** (`src/lib/render.js`) — deterministic HTML-canvas render at the 1320×2868 master: background, screenshot card (high, bottom bleeds off), auto-fit heading, wrapped subtext, and the native pop-out (`drawPopout`: crop a region → enlarge → white frame + shadow → float over the card). Same code drives the live preview and the export, so what you see is what ships.
- **export** (`server/index.js → /api/export`) — `sharp` cover-crops each rendered screen to exact target pixels and streams a foldered zip.

## Project layout

```
shared/sizes.js        size matrix + safe-zone constants (client + server)
src/lib/render.js      canvas compositor incl. drawPopout (single source of truth)
src/lib/fonts.js       font catalog + webfont loader
src/components/        BackgroundPicker, CanvasPreview, PopoutSelector
src/App.jsx            wizard / state
server/index.js        /api/export (sharp + zip)
scripts/               CLI test harness — HTML fixtures + standalone scaffold builder
output/                generated samples + showcase
```

## CLI test harness (optional)

Reproduces the pipeline without the browser, used to validate output:

```bash
# screenshot a reconstructed app screen -> fixture PNG (headless Chrome)
# build scaffold, then enhance via your Gemini MCP / API
node scripts/scaffold.mjs scripts/fixtures/score.png "SCORE" "EVERY SHOT LIVE" "#16A34A" output/scaffold-01.png
```
