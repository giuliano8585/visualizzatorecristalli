/**
 * WebWorker: Image Processing Pipeline → Point Cloud
 * 
 * Step A: Preprocessing 2D (grayscale, contrast, gamma, bilateral approx)
 * Step B: Generazione punti 3D con densità proporzionale all'intensità
 * Step C: Normalizzazione su volume cristallo
 */

export interface WorkerInput {
  imageData: ImageDataTransfer
  crystalDims: [number, number, number]   // cm [w, h, d]
  padding: number                          // cm
  density: number                          // 0..1
  depthRange: number                       // cm
  threshold: number                        // 0..1
  gamma: number
  depthMode: 'JITTER' | 'GRAYSCALE_2_5D'
  seed: number
  maxPoints: number
}

export interface ImageDataTransfer {
  data: Uint8ClampedArray
  width: number
  height: number
}

export interface WorkerOutput {
  positions: Float32Array
  intensities: Float32Array
  count: number
}

// ── Seeded PRNG (Mulberry32) ─────────────────────────────────────────────────
function mulberry32(seed: number) {
  let s = seed >>> 0
  return () => {
    s += 0x6D2B79F5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 0xFFFFFFFF
  }
}

// ── Gaussian blur approximante (box blur 3 pass) ─────────────────────────────
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const dst = new Float32Array(w * h)
  const inv = 1 / (2 * r + 1)
  // orizzontale
  for (let y = 0; y < h; y++) {
    let sum = 0
    for (let x = 0; x < 2 * r + 1; x++) sum += src[y * w + Math.min(x, w - 1)]
    for (let x = 0; x < w; x++) {
      dst[y * w + x] = sum * inv
      const l = Math.max(0, x - r)
      const rr = Math.min(w - 1, x + r + 1)
      sum -= src[y * w + l]
      sum += src[y * w + rr]
    }
  }
  // verticale
  const dst2 = new Float32Array(w * h)
  for (let x = 0; x < w; x++) {
    let sum = 0
    for (let y = 0; y < 2 * r + 1; y++) sum += dst[Math.min(y, h - 1) * w + x]
    for (let y = 0; y < h; y++) {
      dst2[y * w + x] = sum * inv
      const t = Math.max(0, y - r)
      const b = Math.min(h - 1, y + r + 1)
      sum -= dst[t * w + x]
      sum += dst[b * w + x]
    }
  }
  return dst2
}

// ── Unsharp mask ─────────────────────────────────────────────────────────────
function unsharpMask(src: Float32Array, w: number, h: number, amount: number): Float32Array {
  const blurred = boxBlur(src, w, h, 2)
  const out = new Float32Array(w * h)
  for (let i = 0; i < src.length; i++) {
    out[i] = Math.min(1, Math.max(0, src[i] + amount * (src[i] - blurred[i])))
  }
  return out
}

// ── Blue noise dithering semplificato ────────────────────────────────────────
function generateBlueNoiseSamples(count: number, rand: () => number): Float32Array {
  // Approx blue noise via rejection sampling con minimum distance
  const pts = new Float32Array(count * 2)
  const placed: [number, number][] = []
  const minDist = 0.8 / Math.sqrt(count)
  let idx = 0
  let attempts = 0
  while (idx < count && attempts < count * 20) {
    attempts++
    const x = rand()
    const y = rand()
    let ok = true
    for (let i = 0; i < placed.length && ok; i++) {
      const dx = placed[i][0] - x
      const dy = placed[i][1] - y
      if (dx * dx + dy * dy < minDist * minDist) ok = false
    }
    if (ok || placed.length < 10) {
      pts[idx * 2] = x
      pts[idx * 2 + 1] = y
      placed.push([x, y])
      idx++
    }
  }
  return pts.slice(0, idx * 2)
}

// ── Pipeline principale ───────────────────────────────────────────────────────
self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const {
    imageData,
    crystalDims,
    padding,
    density,
    depthRange,
    threshold,
    gamma,
    depthMode,
    seed,
    maxPoints,
  } = e.data

  const { data, width, height } = imageData

  // ── Step A: Preprocessing ──────────────────────────────────────────────────
  postMessage({ type: 'progress', value: 0.05 })

  // 1. Grayscale (luminosità percepita)
  const gray = new Float32Array(width * height)
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4] / 255
    const g = data[i * 4 + 1] / 255
    const b = data[i * 4 + 2] / 255
    gray[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  // 2. Gamma correction (boost contrasto)
  const gammaMap = new Float32Array(width * height)
  for (let i = 0; i < gray.length; i++) {
    gammaMap[i] = Math.pow(gray[i], 1.0 / gamma)
  }

  // 3. Unsharp mask per dettaglio
  const sharpened = unsharpMask(gammaMap, width, height, 0.6)

  postMessage({ type: 'progress', value: 0.25 })

  // 4. Normalizzazione (stretch contrasto)
  let minV = Infinity, maxV = -Infinity
  for (let i = 0; i < sharpened.length; i++) {
    if (sharpened[i] < minV) minV = sharpened[i]
    if (sharpened[i] > maxV) maxV = sharpened[i]
  }
  const range = maxV - minV || 1
  for (let i = 0; i < sharpened.length; i++) {
    sharpened[i] = (sharpened[i] - minV) / range
  }

  // ── Step B: Generazione punti 3D ──────────────────────────────────────────
  postMessage({ type: 'progress', value: 0.35 })

  const rand = mulberry32(seed)

  // Calcola volume incidibile (in scene units = cm)
  const [cw, ch, cd] = crystalDims
  const innerW = cw - padding * 2
  const innerH = ch - padding * 2
  const innerD = cd - padding * 2
  const depthClamped = Math.min(depthRange, innerD * 0.85)

  // Stima punti da generare
  const scaledMax = Math.floor(maxPoints * density)

  // Downsample immagine a max 256×256 per performance
  const SAMPLE_W = Math.min(width, 256)
  const SAMPLE_H = Math.min(height, 256)
  const xRatio = width / SAMPLE_W
  const yRatio = height / SAMPLE_H

  // Calcola intensità totale per pesi
  const weights: number[] = []
  const coords: [number, number][] = []
  let totalWeight = 0

  for (let sy = 0; sy < SAMPLE_H; sy++) {
    for (let sx = 0; sx < SAMPLE_W; sx++) {
      const px = Math.floor(sx * xRatio)
      const py = Math.floor(sy * yRatio)
      const intensity = sharpened[py * width + px]
      if (intensity > threshold) {
        weights.push(intensity)
        coords.push([sx / SAMPLE_W, sy / SAMPLE_H])
        totalWeight += intensity
      }
    }
  }

  postMessage({ type: 'progress', value: 0.50 })

  // Numero punti per pixel proporzionale all'intensità
  const positions: number[] = []
  const intensities: number[] = []

  for (let i = 0; i < weights.length && positions.length / 3 < scaledMax; i++) {
    const w = weights[i]
    const [u, v] = coords[i]
    // k punti per pixel: 1..5 proporzionale a intensità
    const k = Math.max(1, Math.round(w * 5 * density))

    for (let j = 0; j < k && positions.length / 3 < scaledMax; j++) {
      // posizione x,y con jitter sub-pixel
      const jx = (rand() - 0.5) * (1.0 / SAMPLE_W) * 1.5
      const jy = (rand() - 0.5) * (1.0 / SAMPLE_H) * 1.5

      // mappa UV → coordinate scene
      const sceneX = (u + jx - 0.5) * innerW
      const sceneY = -(v + jy - 0.5) * innerH  // flip Y

      // profondità z
      let sceneZ: number
      if (depthMode === 'GRAYSCALE_2_5D') {
        // luminosità alta → più vicino alla superficie (z positivo)
        // luminosità bassa → più profondo
        const depthFactor = 1.0 - w
        sceneZ = (depthFactor - 0.5) * depthClamped + (rand() - 0.5) * 0.08
      } else {
        // JITTER: distribuzione casuale nello spessore
        sceneZ = (rand() - 0.5) * depthClamped
      }

      // Clamp entro volume interno
      const halfW = innerW / 2, halfH = innerH / 2, halfD = innerD / 2
      if (
        Math.abs(sceneX) < halfW &&
        Math.abs(sceneY) < halfH &&
        Math.abs(sceneZ) < halfD
      ) {
        positions.push(sceneX, sceneY, sceneZ)
        intensities.push(w)
      }
    }
  }

  postMessage({ type: 'progress', value: 0.90 })

  const posArray = new Float32Array(positions)
  const intArray = new Float32Array(intensities)

  postMessage({
    type: 'result',
    positions: posArray,
    intensities: intArray,
    count: posArray.length / 3,
  }, { transfer: [posArray.buffer, intArray.buffer] })

  postMessage({ type: 'progress', value: 1.0 })
}
