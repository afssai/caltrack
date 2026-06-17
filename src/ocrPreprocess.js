// OCR preprocessing pipeline — runs 100% in the browser, zero API calls.
// Pipeline: upscale → best-channel grayscale → contrast stretch → adaptive threshold
//           → auto-invert → deskew → [optional de-bow for cylindrical labels] → sharpen

const TARGET_PX = 2400; // upscale target — Tesseract reads better at higher res

// ─── pixel helpers ────────────────────────────────────────────────────────────

// Pick the single RGB channel with the highest contrast (max-min range).
// On colorful packaging (red bag, blue text) one channel separates text
// from background far better than the standard luminance blend.
function grayscale(data) {
  // Sample every 8th pixel for speed when measuring channel ranges
  let rLo = 255, rHi = 0, gLo = 255, gHi = 0, bLo = 255, bHi = 0;
  for (let i = 0; i < data.length; i += 32) {
    if (data[i]     < rLo) rLo = data[i];     if (data[i]     > rHi) rHi = data[i];
    if (data[i + 1] < gLo) gLo = data[i + 1]; if (data[i + 1] > gHi) gHi = data[i + 1];
    if (data[i + 2] < bLo) bLo = data[i + 2]; if (data[i + 2] > bHi) bHi = data[i + 2];
  }
  const rRange = rHi - rLo, gRange = gHi - gLo, bRange = bHi - bLo;
  // If all channels are similar use luminance; otherwise use highest-contrast channel
  const maxRange = Math.max(rRange, gRange, bRange);
  const ch = (maxRange > 40 && maxRange > Math.min(rRange, gRange, bRange) * 1.5)
    ? (rRange >= gRange && rRange >= bRange ? 0 : gRange >= bRange ? 1 : 2)
    : -1; // -1 = luminance
  for (let i = 0; i < data.length; i += 4) {
    const g = ch === -1
      ? 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      : data[i + ch];
    data[i] = data[i + 1] = data[i + 2] = g;
  }
}

// After binarisation, if the majority of pixels are dark the label has
// light text on a dark/coloured background — invert so Tesseract sees
// the dark-on-light it was trained on.
function autoInvert(imgData) {
  const { data } = imgData;
  let dark = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i] < 128) dark++;
  if (dark / (data.length / 4) > 0.5) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = data[i + 1] = data[i + 2] = 255 - data[i];
    }
  }
}

function stretchContrast(data) {
  let lo = 255, hi = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] < lo) lo = data[i];
    if (data[i] > hi) hi = data[i];
  }
  const range = hi - lo || 1;
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.round(((data[i] - lo) / range) * 255);
    data[i] = data[i + 1] = data[i + 2] = v;
  }
}

// Fast adaptive threshold using integral image — O(1) per pixel lookup.
// Much better than global threshold for labels with uneven lighting.
function adaptiveThreshold(imageData, blockSize = 41, C = 10) {
  const { width, height, data } = imageData;
  const W1 = width + 1;

  // Build summed area table
  const sat = new Float64Array(W1 * (height + 1));
  for (let y = 1; y <= height; y++) {
    for (let x = 1; x <= width; x++) {
      sat[y * W1 + x] =
        data[((y - 1) * width + (x - 1)) * 4] +
        sat[(y - 1) * W1 + x] +
        sat[y * W1 + (x - 1)] -
        sat[(y - 1) * W1 + (x - 1)];
    }
  }

  const half = Math.floor(blockSize / 2);
  const out = new Uint8ClampedArray(data.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - half);
      const y1 = Math.max(0, y - half);
      const x2 = Math.min(width - 1, x + half);
      const y2 = Math.min(height - 1, y + half);
      const area = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum =
        sat[(y2 + 1) * W1 + (x2 + 1)] -
        sat[y1 * W1 + (x2 + 1)] -
        sat[(y2 + 1) * W1 + x1] +
        sat[y1 * W1 + x1];
      const mean = sum / area;
      const idx = (y * width + x) * 4;
      const val = data[idx] < mean - C ? 0 : 255;
      out[idx] = out[idx + 1] = out[idx + 2] = val;
      out[idx + 3] = 255;
    }
  }

  return new ImageData(out, width, height);
}

// Laplacian sharpen kernel
function sharpen(data, width, height) {
  const copy = new Uint8ClampedArray(data);
  const k = [-1, -1, -1, -1, 9, -1, -1, -1, -1];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let v = 0;
      for (let ky = -1; ky <= 1; ky++)
        for (let kx = -1; kx <= 1; kx++)
          v += copy[((y + ky) * width + (x + kx)) * 4] * k[(ky + 1) * 3 + (kx + 1)];
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.max(0, Math.min(255, v));
    }
  }
}

// ─── deskew ───────────────────────────────────────────────────────────────────

// Detect skew via horizontal projection profile on a downsampled grayscale copy.
// For each candidate angle: rotate pixel coordinates → accumulate row sums →
// measure variance. Highest variance = text rows are most aligned.
function detectSkewAngle(canvas) {
  const SAMPLE = 600; // work on a small copy for speed
  const ratio = SAMPLE / Math.max(canvas.width, canvas.height);
  const sw = Math.round(canvas.width * ratio);
  const sh = Math.round(canvas.height * ratio);

  const tmp = document.createElement("canvas");
  tmp.width = sw; tmp.height = sh;
  const tc = tmp.getContext("2d");
  tc.drawImage(canvas, 0, 0, sw, sh);
  const { data } = tc.getImageData(0, 0, sw, sh);

  // Build binary map (1 = dark pixel)
  const bin = new Uint8Array(sw * sh);
  for (let i = 0; i < sw * sh; i++) bin[i] = data[i * 4] < 128 ? 1 : 0;

  const cx = sw / 2, cy = sh / 2;
  let bestAngle = 0, bestVar = -1;

  for (let deg = -15; deg <= 15; deg += 0.5) {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const rows = new Float32Array(sh);

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        if (!bin[y * sw + x]) continue;
        const ry = Math.round((x - cx) * sin + (y - cy) * cos + cy);
        if (ry >= 0 && ry < sh) rows[ry]++;
      }
    }

    let mean = 0;
    for (const r of rows) mean += r;
    mean /= sh;
    let variance = 0;
    for (const r of rows) variance += (r - mean) ** 2;

    if (variance > bestVar) { bestVar = variance; bestAngle = deg; }
  }

  return bestAngle;
}

function rotateCanvas(src, angleDeg) {
  const rad = (-angleDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
  const W = Math.round(src.width * cos + src.height * sin);
  const H = Math.round(src.width * sin + src.height * cos);
  const out = document.createElement("canvas");
  out.width = W; out.height = H;
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  ctx.translate(W / 2, H / 2);
  ctx.rotate(rad);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return out;
}

// ─── cylindrical de-bow ───────────────────────────────────────────────────────
// For labels on cans/bottles — text rows bow upward at the centre.
// Uses inverse mapping: for each output pixel, find its source pixel.
function debowCylindrical(srcCanvas, strength = 0.18) {
  const W = srcCanvas.width, H = srcCanvas.height;
  const src = srcCanvas.getContext("2d").getImageData(0, 0, W, H).data;
  const out = document.createElement("canvas");
  out.width = W; out.height = H;
  const ctx = out.getContext("2d");
  const dst = ctx.createImageData(W, H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x / W - 0.5) * 2; // –1 … 1
      // Parabolic bow: centre of each row is lifted
      const bow = (1 - nx * nx) * strength;
      const srcY = Math.round(y + bow * H);
      const di = (y * W + x) * 4;
      if (srcY >= 0 && srcY < H) {
        const si = (srcY * W + x) * 4;
        dst.data[di] = src[si];
        dst.data[di + 1] = src[si + 1];
        dst.data[di + 2] = src[si + 2];
      } else {
        dst.data[di] = dst.data[di + 1] = dst.data[di + 2] = 255;
      }
      dst.data[di + 3] = 255;
    }
  }

  ctx.putImageData(dst, 0, 0);
  return out;
}

// ─── main export ──────────────────────────────────────────────────────────────

/**
 * Preprocess an image file for nutrition label OCR.
 * @param {File|Blob} file   The raw image from the camera or gallery.
 * @param {boolean}   cylindrical  Set true for cans/bottles with curved labels.
 * @returns {Promise<Blob>}  PNG ready to pass to Tesseract.
 */
export async function preprocessLabel(file, cylindrical = false) {
  const bitmap = await createImageBitmap(file);

  // 1. Upscale — Tesseract accuracy improves significantly above 1500px
  const scale = Math.min(3.5, TARGET_PX / Math.max(bitmap.width, bitmap.height));
  const W = Math.round(bitmap.width * scale);
  const H = Math.round(bitmap.height * scale);

  let canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  let ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(bitmap, 0, 0, W, H);
  bitmap.close?.();

  // 2. Cylindrical de-bow BEFORE grayscale (works on colour image)
  if (cylindrical) canvas = debowCylindrical(canvas);

  // 3. Grayscale + contrast stretch
  ctx = canvas.getContext("2d", { willReadFrequently: true });
  let img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  grayscale(img.data);
  stretchContrast(img.data);
  ctx.putImageData(img, 0, 0);

  // 4. Deskew — detect angle on greyscale, rotate to straighten
  const angle = detectSkewAngle(canvas);
  if (Math.abs(angle) > 0.4) {
    canvas = rotateCanvas(canvas, angle);
    ctx = canvas.getContext("2d", { willReadFrequently: true });
  }

  // 5. Adaptive threshold — binarize with local block mean
  img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  img = adaptiveThreshold(img, 41, 10);

  // 6. Auto-invert — if background is dark (coloured packaging), flip to dark-on-white
  autoInvert(img);

  // 7. Sharpen
  sharpen(img.data, canvas.width, canvas.height);

  ctx.putImageData(img, 0, 0);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
