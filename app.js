(() => {
  "use strict";

  /* ---------------- state ---------------- */
  const state = {
    format: "A",           // "A" = Profile Frame, "B" = Builder ID Card
    img: null,             // loaded HTMLImageElement
    imgAspect: 1,
    zoom: 1,               // 1.0 - 2.5
    pan: { x: 0, y: 0 },   // fraction offset, -0.5..0.5 range roughly
    rotation: 0,           // fine straighten, degrees, -45..45
    name: "",
    role: "",
    title: "",
    serial: "HHG-" + Math.floor(100000 + Math.random() * 899999),
    dragging: false,
    dragStart: null,
    panStart: null,
  };

  const CANVAS_SIZE = { A: [1080, 1080], B: [1080, 1350] };

  /* ---------------- element refs ---------------- */
  const canvas = document.getElementById("badgeCanvas");
  const ctx = canvas.getContext("2d");
  const previewFrame = document.querySelector(".preview__frame");
  const previewEmpty = document.getElementById("previewEmpty");
  const dropzone = document.getElementById("dropzone");
  const photoInput = document.getElementById("photoInput");
  const repositionControls = document.getElementById("repositionControls");
  const zoomRange = document.getElementById("zoomRange");
  const rotationRange = document.getElementById("rotationRange");
  const rotationValue = document.getElementById("rotationValue");
  const rotateLeftBtn = document.getElementById("rotateLeftBtn");
  const rotateRightBtn = document.getElementById("rotateRightBtn");
  const idFields = document.getElementById("idFields");
  const nameInput = document.getElementById("nameInput");
  const roleInput = document.getElementById("roleInput");
  const titleInput = document.getElementById("titleInput");
  const downloadBtn = document.getElementById("downloadBtn");
  const shareBtn = document.getElementById("shareBtn");
  const statusMsg = document.getElementById("statusMsg");
  const serialTag = document.getElementById("serialTag");
  const formatBtns = document.querySelectorAll(".format-btn");

  serialTag.textContent = state.serial;

  /* ---------------- palette (kept in sync with style.css) ---------------- */
  const PALETTE = {
    ink: "#0B2B27",
    inkSoft: "#12362F",
    foam: "#F6F1E4",
    coral: "#FF6A45",
    coralDim: "#C94F31",
    gold: "#F0BE6B",
    palm: "#2E8C73",
  };

  /* ---------------- helpers ---------------- */
  function setStatus(msg, isError = false) {
    statusMsg.textContent = msg || "";
    statusMsg.classList.toggle("is-error", !!isError);
  }

  function setCanvasSizeForFormat() {
    const [w, h] = CANVAS_SIZE[state.format];
    canvas.width = w;
    canvas.height = h;
    previewFrame.style.aspectRatio = `${w} / ${h}`;
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  /* Draw the user photo with "cover" fit inside a rect, honoring zoom + pan */
  function drawCoverImage(context, img, x, y, w, h, zoom, pan) {
    const imgRatio = img.width / img.height;
    const boxRatio = w / h;
    let sw, sh; // source crop width/height (in source px)
    if (imgRatio > boxRatio) {
      sh = img.height / zoom;
      sw = sh * boxRatio;
    } else {
      sw = img.width / zoom;
      sh = sw / boxRatio;
    }
    sw = Math.min(sw, img.width);
    sh = Math.min(sh, img.height);

    const maxOffX = (img.width - sw) / 2;
    const maxOffY = (img.height - sh) / 2;
    const sx = clamp(img.width / 2 - sw / 2 - pan.x * img.width, 0, img.width - sw);
    const sy = clamp(img.height / 2 - sh / 2 - pan.y * img.height, 0, img.height - sh);

    context.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    return { maxOffX, maxOffY };
  }

  /* Like drawCoverImage, but also applies a fine rotation (degrees) around
     the box centre. The source box is padded before rotating so the
     rotated image still fully covers the target rect with no gaps. */
  function drawRotatedCover(context, img, x, y, w, h, zoom, pan, rotationDeg) {
    if (!rotationDeg) {
      drawCoverImage(context, img, x, y, w, h, zoom, pan);
      return;
    }
    const theta = (rotationDeg * Math.PI) / 180;
    const cos = Math.abs(Math.cos(theta));
    const sin = Math.abs(Math.sin(theta));
    const padW = w * cos + h * sin;
    const padH = w * sin + h * cos;
    const cx = x + w / 2;
    const cy = y + h / 2;
    context.save();
    context.translate(cx, cy);
    context.rotate(theta);
    drawCoverImage(context, img, -padW / 2, -padH / 2, padW, padH, zoom, pan);
    context.restore();
  }

  /* Draw text along an arc. angleSpread in radians, centered on `centerAngle`.
     `flip: true` keeps text upright when centerAngle sits on the lower half
     of the circle (reads left-to-right instead of mirrored/upside-down). */
  function drawArcText(context, text, cx, cy, radius, centerAngle, angleSpread, options = {}) {
    const { font = "600 34px 'Space Grotesk'", color = PALETTE.foam, flip = false } = options;
    context.save();
    context.font = font;
    context.fillStyle = color;
    context.textAlign = "center";
    context.textBaseline = "middle";

    const chars = flip ? [...text].reverse() : [...text];
    const widths = chars.map((ch) => context.measureText(ch).width);
    const totalWidth = widths.reduce((a, b) => a + b, 0);
    const anglePerPixel = angleSpread / totalWidth;

    let angle = centerAngle - angleSpread / 2;
    for (let i = 0; i < chars.length; i++) {
      const chWidth = widths[i];
      const chAngle = angle + (chWidth * anglePerPixel) / 2;
      const drawAngle = flip ? chAngle + Math.PI : chAngle;
      const px = cx + radius * Math.sin(chAngle);
      const py = cy - radius * Math.cos(chAngle);
      context.save();
      context.translate(px, py);
      context.rotate(drawAngle);
      context.fillText(chars[i], 0, 0);
      context.restore();
      angle += chWidth * anglePerPixel;
    }
    context.restore();
  }

  function fitFontSize(context, text, maxWidth, startSize, family, minSize = 24) {
    let size = startSize;
    context.font = `400 ${size}px ${family}`;
    while (context.measureText(text).width > maxWidth && size > minSize) {
      size -= 2;
      context.font = `400 ${size}px ${family}`;
    }
    return size;
  }

  function drawPalmIcon(context, cx, cy, scale = 1, color = PALETTE.foam) {
    context.save();
    context.translate(cx, cy);
    context.scale(scale, scale);
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = 3;
    // trunk
    context.beginPath();
    context.moveTo(0, 30);
    context.quadraticCurveTo(6, 10, 2, -6);
    context.lineWidth = 4;
    context.stroke();
    // fronds
    const fronds = [
      [-40, -30, -10, -10],
      [40, -30, 10, -10],
      [-30, -46, 0, -14],
      [30, -46, 0, -14],
      [0, -50, 2, -16],
    ];
    fronds.forEach(([ex, ey, cx2, cy2]) => {
      context.beginPath();
      context.moveTo(2, -6);
      context.quadraticCurveTo(cx2, cy2, ex, ey);
      context.lineWidth = 3;
      context.stroke();
    });
    context.restore();
  }

  function roundRectPath(context, x, y, w, h, r) {
    const rr = typeof r === "number" ? { tl: r, tr: r, br: r, bl: r } : r;
    context.beginPath();
    context.moveTo(x + rr.tl, y);
    context.lineTo(x + w - rr.tr, y);
    context.arcTo(x + w, y, x + w, y + rr.tr, rr.tr);
    context.lineTo(x + w, y + h - rr.br);
    context.arcTo(x + w, y + h, x + w - rr.br, y + h, rr.br);
    context.lineTo(x + rr.bl, y + h);
    context.arcTo(x, y + h, x, y + h - rr.bl, rr.bl);
    context.lineTo(x, y + rr.tl);
    context.arcTo(x, y, x + rr.tl, y, rr.tl);
    context.closePath();
  }

  /* ---------------- background wash (shared) ---------------- */
  function paintBackground(context, w, h) {
    const g = context.createRadialGradient(w * 0.5, h * 0.08, w * 0.1, w * 0.5, h * 0.55, w * 0.9);
    g.addColorStop(0, "#123A33");
    g.addColorStop(0.55, PALETTE.ink);
    g.addColorStop(1, "#071815");
    context.fillStyle = g;
    context.fillRect(0, 0, w, h);
  }

  /* ================= FORMAT A — Profile Frame ================= */
  function renderFormatA() {
    const w = canvas.width, h = canvas.height;
    paintBackground(ctx, w, h);

    const cx = w / 2, cy = h / 2 + 10;
    const R = w * 0.375;

    // photo (clipped circle)
    if (state.img) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      drawRotatedCover(ctx, state.img, cx - R, cy - R, R * 2, R * 2, state.zoom, state.pan, state.rotation);
      ctx.restore();
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(246,241,228,0.06)";
      ctx.fill();
      ctx.restore();
    }

    // ring — gradient coral to gold
    const ringGrad = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    ringGrad.addColorStop(0, PALETTE.coral);
    ringGrad.addColorStop(1, PALETTE.gold);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R + 14, 0, Math.PI * 2);
    ctx.lineWidth = 16;
    ctx.strokeStyle = ringGrad;
    ctx.stroke();
    ctx.restore();

    // dashed inner ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R + 34, 0, Math.PI * 2);
    ctx.setLineDash([2, 14]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(246,241,228,0.5)";
    ctx.stroke();
    ctx.restore();

    // arc text top
    drawArcText(ctx, "#FRAMEINGOA", cx, cy, R + 78, 0, Math.PI * 0.6, {
      font: "600 32px 'JetBrains Mono'",
      color: PALETTE.gold,
    });
    // arc text bottom (flipped so it reads upright, left-to-right)
    drawArcText(ctx, "HH GOA 2026", cx, cy, R + 78, Math.PI, Math.PI * 0.62, {
      font: "700 40px 'Space Grotesk'",
      color: PALETTE.foam,
      flip: true,
    });

    // corner stamp
    ctx.save();
    ctx.translate(w - 128, 128);
    ctx.rotate(-0.2);
    ctx.beginPath();
    ctx.arc(0, 0, 74, 0, Math.PI * 2);
    ctx.setLineDash([3, 6]);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = PALETTE.coral;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = PALETTE.foam;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 20px 'Space Grotesk'";
    ctx.fillText("BUILDER", 0, -4);
    ctx.font = "500 13px 'JetBrains Mono'";
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText("EST. 2026", 0, 18);
    ctx.restore();

    drawPalmIcon(ctx, 108, 118, 1.1, "rgba(246,241,228,0.45)");

    // bottom coords
    ctx.save();
    ctx.font = "500 18px 'JetBrains Mono'";
    ctx.fillStyle = "rgba(246,241,228,0.4)";
    ctx.textAlign = "right";
    ctx.fillText("15.2993°N 74.1240°E", w - 60, h - 54);
    ctx.restore();
  }

  /* ================= FORMAT B — Builder ID Card ================= */
  function renderFormatB() {
    const w = canvas.width, h = canvas.height;
    paintBackground(ctx, w, h);

    const pad = 56;
    const cardX = pad, cardY = pad, cardW = w - pad * 2, cardH = h - pad * 2;

    // card panel
    ctx.save();
    roundRectPath(ctx, cardX, cardY, cardW, cardH, 34);
    const panelGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    panelGrad.addColorStop(0, "#0F3830");
    panelGrad.addColorStop(1, "#0A2621");
    ctx.fillStyle = panelGrad;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(246,241,228,0.18)";
    ctx.stroke();
    ctx.restore();

    // header strip
    ctx.save();
    ctx.font = "700 24px 'JetBrains Mono'";
    ctx.fillStyle = PALETTE.gold;
    ctx.textAlign = "left";
    ctx.fillText("HH GOA 2026", cardX + 44, cardY + 62);
    ctx.font = "500 17px 'JetBrains Mono'";
    ctx.fillStyle = "rgba(246,241,228,0.5)";
    ctx.textAlign = "right";
    ctx.fillText("BUILDER PASS", cardX + cardW - 44, cardY + 62);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(246,241,228,0.15)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cardX + 44, cardY + 84);
    ctx.lineTo(cardX + cardW - 44, cardY + 84);
    ctx.stroke();
    ctx.restore();

    // photo block
    const photoX = cardX + 44, photoY = cardY + 116;
    const photoSize = cardW - 88;
    const photoH = photoSize * 0.86;

    ctx.save();
    roundRectPath(ctx, photoX, photoY, photoSize, photoH, 22);
    ctx.clip();
    if (state.img) {
      drawRotatedCover(ctx, state.img, photoX, photoY, photoSize, photoH, state.zoom, state.pan, state.rotation);
    } else {
      ctx.fillStyle = "rgba(246,241,228,0.06)";
      ctx.fillRect(photoX, photoY, photoSize, photoH);
    }
    // subtle vignette at bottom of photo so name text has contrast if needed
    const vg = ctx.createLinearGradient(0, photoY + photoH * 0.7, 0, photoY + photoH);
    vg.addColorStop(0, "rgba(10,30,26,0)");
    vg.addColorStop(1, "rgba(8,22,19,0.35)");
    ctx.fillStyle = vg;
    ctx.fillRect(photoX, photoY, photoSize, photoH);
    ctx.restore();

    ctx.save();
    roundRectPath(ctx, photoX, photoY, photoSize, photoH, 22);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(246,241,228,0.25)";
    ctx.stroke();
    ctx.restore();

    // corner stamp on photo
    ctx.save();
    ctx.translate(photoX + photoSize - 66, photoY + 66);
    ctx.rotate(0.18);
    ctx.beginPath();
    ctx.arc(0, 0, 46, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(11,43,39,0.55)";
    ctx.fill();
    ctx.setLineDash([2, 5]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = PALETTE.coral;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "700 13px 'Space Grotesk'";
    ctx.fillStyle = PALETTE.foam;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("GOA", 0, -3);
    ctx.font = "500 10px 'JetBrains Mono'";
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText("2026", 0, 11);
    ctx.restore();

    // text block below photo
    let ty = photoY + photoH + 70;
    const textX = cardX + 44;
    const maxTextW = cardW - 88;

    const name = (state.name || "Your Name").toUpperCase();
    ctx.font = "400 64px 'Anton'";
    const nameSize = fitFontSize(ctx, name, maxTextW, 64, "'Anton'", 30);
    ctx.font = `400 ${nameSize}px 'Anton'`;
    ctx.fillStyle = PALETTE.foam;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(name, textX, ty);

    ty += 40;
    const role = state.role || "Builder";
    ctx.font = "600 26px 'Space Grotesk'";
    const roleSize = fitFontSize(ctx, role, maxTextW, 26, "'Space Grotesk'", 16);
    ctx.font = `600 ${roleSize}px 'Space Grotesk'`;
    ctx.fillStyle = PALETTE.coral;
    ctx.fillText(role, textX, ty);

    if (state.title) {
      ty += 34;
      ctx.font = "500 18px 'JetBrains Mono'";
      ctx.fillStyle = "rgba(246,241,228,0.55)";
      ctx.fillText("“" + state.title + "”", textX, ty);
    }

    // footer: barcode + serial
    const footerY = cardY + cardH - 46;
    ctx.save();
    ctx.strokeStyle = "rgba(246,241,228,0.15)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cardX + 44, footerY - 26);
    ctx.lineTo(cardX + cardW - 44, footerY - 26);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.font = "500 15px 'JetBrains Mono'";
    ctx.fillStyle = "rgba(246,241,228,0.45)";
    ctx.textAlign = "left";
    ctx.fillText(state.serial, textX, footerY);
    ctx.textAlign = "right";
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText("#FrameInGoa", cardX + cardW - 44, footerY);
    ctx.restore();
  }

  /* ---------------- master render ---------------- */
  function render() {
    if (state.format === "A") renderFormatA();
    else renderFormatB();
    previewEmpty.style.display = state.img ? "none" : "flex";
    const ready = !!state.img;
    downloadBtn.disabled = !ready;
    shareBtn.disabled = !ready;
  }

  /* ---------------- fonts ready ---------------- */
  function whenFontsReady(cb) {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(cb).catch(cb);
    } else {
      setTimeout(cb, 300);
    }
  }

  /* ---------------- format switching ---------------- */
  formatBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      formatBtns.forEach((b) => { b.classList.remove("is-active"); b.setAttribute("aria-selected", "false"); });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
      state.format = btn.dataset.format;
      idFields.hidden = state.format !== "B";
      setCanvasSizeForFormat();
      render();
    });
  });

  /* ---------------- text inputs ---------------- */
  [["input", nameInput, "name"], ["input", roleInput, "role"], ["input", titleInput, "title"]].forEach(
    ([evt, el, key]) => {
      el.addEventListener(evt, () => { state[key] = el.value; render(); });
    }
  );

  /* ---------------- file loading ---------------- */
  function isHeic(file) {
    const nameMatch = /\.hei[cf]$/i.test(file.name || "");
    const typeMatch = /heic|heif/i.test(file.type || "");
    return nameMatch || typeMatch;
  }

  async function loadImageFromFile(file) {
    setStatus("Loading photo…");
    try {
      let workingFile = file;

      if (isHeic(file)) {
        setStatus("Converting HEIC photo…");
        const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
        workingFile = Array.isArray(converted) ? converted[0] : converted;
      }

      const url = URL.createObjectURL(workingFile);
      const img = new Image();
      img.onload = () => {
        state.img = img;
        state.imgAspect = img.width / img.height;
        state.zoom = 1;
        state.pan = { x: 0, y: 0 };
        state.rotation = 0;
        zoomRange.value = 100;
        rotationRange.value = 0;
        rotationValue.textContent = "0°";
        repositionControls.hidden = false;
        setStatus("Looking sharp. Drag the photo to recentre it.");
        render();
      };
      img.onerror = () => setStatus("Couldn't read that image — try a different file.", true);
      img.src = url;
    } catch (err) {
      console.error(err);
      setStatus("Couldn't process that photo. Try exporting as JPG and retry.", true);
    }
  }

  photoInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) loadImageFromFile(file);
  });

  dropzone.addEventListener("click", () => photoInput.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); photoInput.click(); }
  });

  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add("is-dragover"); })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove("is-dragover"); })
  );
  dropzone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) loadImageFromFile(file);
  });

  /* ---------------- zoom + pan (drag) ---------------- */
  zoomRange.addEventListener("input", () => {
    state.zoom = Number(zoomRange.value) / 100;
    render();
  });

  rotationRange.addEventListener("input", () => {
    state.rotation = Number(rotationRange.value);
    rotationValue.textContent = `${state.rotation}°`;
    render();
  });

  /* Bake a 90° turn into the actual pixel data (for sideways phone photos),
     as opposed to the fine "straighten" slider which only tilts at draw time.
     This is async (canvas -> data URL -> Image decode), so back-to-back clicks
     are queued rather than raced: without this, a second click that fires
     before the first bake's onload lands would read the stale state.img and
     silently clobber the first rotation. */
  let rotationBusy = false;
  let queuedRotation = 0;

  function runBake(direction) {
    const src = state.img;
    const off = document.createElement("canvas");
    off.width = src.height;
    off.height = src.width;
    const octx = off.getContext("2d");
    octx.translate(off.width / 2, off.height / 2);
    octx.rotate((direction * 90 * Math.PI) / 180);
    octx.drawImage(src, -src.width / 2, -src.height / 2);

    const rotated = new Image();
    rotated.onload = () => {
      state.img = rotated;
      state.pan = { x: 0, y: 0 };
      render();

      if (queuedRotation !== 0) {
        const next = queuedRotation > 0 ? 1 : -1;
        queuedRotation -= next;
        runBake(next);
      } else {
        rotationBusy = false;
        rotateLeftBtn.disabled = false;
        rotateRightBtn.disabled = false;
      }
    };
    rotated.src = off.toDataURL("image/png");
  }

  function bakeRotate90(direction) {
    if (!state.img) return;
    if (rotationBusy) {
      // Another bake is mid-flight — queue this turn instead of racing it.
      queuedRotation += direction;
      return;
    }
    rotationBusy = true;
    rotateLeftBtn.disabled = true;
    rotateRightBtn.disabled = true;
    runBake(direction);
  }

  rotateLeftBtn.addEventListener("click", () => bakeRotate90(-1));
  rotateRightBtn.addEventListener("click", () => bakeRotate90(1));

  function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { x: cx / rect.width, y: cy / rect.height };
  }

  function startDrag(e) {
    if (!state.img) return;
    state.dragging = true;
    state.dragStart = pointerPos(e);
    state.panStart = { ...state.pan };
  }
  function moveDrag(e) {
    if (!state.dragging) return;
    e.preventDefault();
    const p = pointerPos(e);
    const dx = p.x - state.dragStart.x;
    const dy = p.y - state.dragStart.y;
    state.pan = {
      x: clamp(state.panStart.x + dx, -0.5, 0.5),
      y: clamp(state.panStart.y + dy, -0.5, 0.5),
    };
    render();
  }
  function endDrag() { state.dragging = false; }

  canvas.addEventListener("mousedown", startDrag);
  window.addEventListener("mousemove", moveDrag);
  window.addEventListener("mouseup", endDrag);
  canvas.addEventListener("touchstart", startDrag, { passive: true });
  window.addEventListener("touchmove", moveDrag, { passive: false });
  window.addEventListener("touchend", endDrag);

  /* ---------------- download ---------------- */
  function getBlob() {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
  }

  downloadBtn.addEventListener("click", async () => {
    const blob = await getBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `HH_Goa_2026_${state.format === "A" ? "Frame" : "Badge"}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setStatus("Badge downloaded. See you in Goa!");
  });

  /* ---------------- share to X ---------------- */
  const TWEET_TEXT = "Hyped for HH Goa 2026! Just built my builder badge. #FrameInGoa";

  shareBtn.addEventListener("click", async () => {
    const blob = await getBlob();
    const file = new File([blob], "HH_Goa_2026.png", { type: "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "HH Goa 2026 Builder Badge",
          text: TWEET_TEXT,
        });
        setStatus("Shared! See you on the timeline.");
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return; // user cancelled
        // fall through to X intent below
      }
    }

    // Desktop / unsupported browsers: download the file, then open a pre-filled X intent.
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "HH_Goa_2026.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);

    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(TWEET_TEXT)}`;
    window.open(intent, "_blank", "noopener");
    setStatus("Badge saved — attach it to the tweet that just opened.");
  });

  /* ---------------- init ---------------- */
  setCanvasSizeForFormat();
  whenFontsReady(render);
})();