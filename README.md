# HH Goa 2026 — Builder Badge Generator

A no-login, static web app. Upload a photo, get a branded **Profile Frame** or
**Builder ID Card** rendered instantly on-device with HTML5 Canvas, then
download it or share it to X with `#FrameInGoa`.

Nothing is uploaded to a server — everything happens in the browser, so it's
fast and works the moment it's deployed as static files.

## What's in here

```
index.html   markup: format toggle, upload dropzone, detail fields, live preview
style.css    the visual design (boarding-pass / ticket theme)
app.js       HEIC conversion, canvas compositing, download, share
assets/      og-default.png — static social-preview image
```

## Run it locally

Any static file server works, e.g.:

```bash
cd hh-goa-2026
python3 -m http.server 8000
# open http://localhost:8000
```
