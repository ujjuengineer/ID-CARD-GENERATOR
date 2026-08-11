# HH Goa 2026 — Builder Badge Generator

Upload a photo, get a shareable "I'm building at HH Goa 2026" badge in seconds — entirely in your browser. No backend, no upload, no signup.

**Live badge formats:**
- **Profile Frame** — a round badge for your social DP, with an arc-text ring (`#FRAMEINGOA` · `HH GOA 2026`).
- **Builder ID Card** — a portrait "conference pass" style card with your name, role/stack, and a builder title.

Built for **HH Goa 2026** (15–16 Aug) · `#FrameInGoa`

---

## Why this exists

Hackathon attendees love flexing that they're building somewhere cool — but most badge/frame generators either need a signup, upload your photo to a server, or produce something generic. This tool renders everything on-device with the Canvas API, so it's instant, private, and works straight off an iPhone camera roll (including HEIC).

## Features

- 🖼️ **Two badge formats** — round profile frame or portrait ID card, switchable instantly.
- 📱 **HEIC support** — iPhone photos convert to JPEG in-browser via `heic2any`, no server round-trip.
- 🎯 **Drag-to-reposition, pinch/slider zoom, and rotate** — fine "straighten" slider (±45°) plus 90° left/right rotate for sideways phone photos, all baked into the final render.
- ⚡ **100% client-side** — nothing is uploaded anywhere; the badge is rendered on an HTML `<canvas>` and exported locally.
- 📤 **One-tap share** — uses the native Web Share API on mobile (shares the image directly to X/other apps) with a pre-filled-tweet fallback on desktop.
- 🎨 **On-brand visual design** — custom coral/sand/palm color system, Anton/Space Grotesk/JetBrains Mono type, hand-drawn arc text and stamp details.
- ♿ Accessible controls (keyboard-operable dropzone, `aria-live` status messages, labeled inputs).

## Tech stack

- **Vanilla JS, HTML, CSS** — no build step, no framework, no dependencies to install.
- [`heic2any`](https://github.com/alexcorvi/heic2any) (via CDN) for HEIC → JPEG conversion.
- Google Fonts: Anton, Space Grotesk, JetBrains Mono.
- Renders via the Canvas 2D API — all badge artwork (rings, arc text, palm icon, ID card layout) is drawn programmatically, no image assets required.

## Project structure

```
.
├── index.html   # markup — format toggle, upload/reposition controls, live preview
├── style.css    # design tokens + layout (desktop 2-column "ticket", reflowed for mobile)
└── app.js       # all badge logic: state, canvas rendering, file handling, download/share
```

## Running locally

No build tools needed — it's static.

```bash
# any static file server works, e.g.:
npx serve .
# or
python3 -m http.server 8000
```

Then open the printed local URL in your browser.

> Opening `index.html` directly via `file://` mostly works too, but some browsers restrict `canvas.toDataURL()` / blob URLs under `file://`, so a local server is recommended for testing photo upload and download.

## Deploying

This is a fully static site — any static host works out of the box:

- **Netlify / Vercel** — drag-and-drop the folder or connect the repo; live in under a minute.
- **GitHub Pages** — push and enable Pages in repo settings.
- **Cloudflare Pages** — connect the repo for a free, fast global CDN.

No environment variables or backend config required. Just make sure outbound requests to `fonts.googleapis.com`, `fonts.gstatic.com`, and `cdn.jsdelivr.net` (for `heic2any`) aren't blocked by the host.

## How it works (high level)

1. User picks a format (`A` = Profile Frame, `B` = Builder ID Card) — this sets the canvas dimensions (`1080×1080` or `1080×1350`).
2. User uploads/drops a photo (HEIC is auto-converted); it loads into an in-memory `Image`.
3. Zoom, drag-to-pan, fine straighten (±45°), and 90°-bake rotate all update shared `state` and trigger a re-render.
4. `render()` draws the background wash, clipped/rotated cover-fit photo, decorative ring/arc-text/stamp (format A) or card panel/text block (format B), onto the `<canvas>`.
5. **Download** exports the canvas as a PNG. **Share** uses `navigator.share` with the canvas blob where supported, falling back to a download + pre-filled X (Twitter) intent link on desktop.

## Known constraints

- Fonts (`Anton`, `Space Grotesk`, `JetBrains Mono`) are loaded from Google Fonts — offline/dev environments without internet access will fall back to system fonts.
- HEIC conversion and PNG export can be a little slower on very high-resolution phone photos; the 90° rotate buttons queue/lock while a rotation is processing so rapid taps don't get lost or race each other.

## Credits

Built for **HH Goa 2026**. Tag your badge `#FrameInGoa` 🌴