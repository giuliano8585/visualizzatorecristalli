/**
 * WebWorker: Image Processing Pipeline → Point Cloud
 * v2 – Edge detection, colori per profondità, campionamento migliorato
 *
 * Step A: Preprocessing 2D (grayscale, contrast, gamma, bilateral approx, edge detect)
 * Step B: Generazione punti 3D con densità proporzionale all'intensità + bordi
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
  positions:   Float32Array
  intensities: Float32Array
  count:       number
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

// ── Box blur separabile ───────────────────────────────────────────────────────
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const dst  = new Float32Array(w * h)
  const inv  = 1 / (2 * r + 1)
  // pass orizzontale
  for (let y = 0; y < h; y++) {
    let sum = 0
    for (let x = 0; x < 2 * r + 1; x++) sum += src[y * w + Math.min(x, w - 1)]
    for (let x = 0; x < w; x++) {
      dst[y * w + x] = sum * inv
      sum -= src[y * w + Math.max(0, x - r)]
      sum += src[y * w + Math.min(w - 1, x + r + 1)]
    }
  }
  // pass verticale
  const dst2 = new Float32Array(w * h)
  for (let x = 0; x < w; x++) {
    let sum = 0
    for (let y = 0; y < 2 * r + 1; y++) sum += dst[Math.min(y, h - 1) * w + x]
    for (let y = 0; y < h; y++) {
      dst2[y * w + x] = sum * inv
      sum -= dst[Math.max(0, y - r) * w + x]
      sum += dst[Math.min(h - 1, y + r + 1) * w + x]
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

// ── Sobel edge detection ──────────────────────────────────────────────────────
function sobelEdges(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const tl = src[(y - 1) * w + (x - 1)], tc = src[(y - 1) * w + x], tr = src[(y - 1) * w + (x + 1)]
      const ml = src[y * w + (x - 1)],                                    mr = src[y * w + (x + 1)]
      const bl = src[(y + 1) * w + (x - 1)], bc = src[(y + 1) * w + x], br = src[(y + 1) * w + (x + 1)]

      const gx = (-tl + tr - 2 * ml + 2 * mr - bl + br)
      const gy = (-tl - 2 * tc - tr + bl + 2 * bc + br)
      out[y * w + x] = Math.min(1, Math.sqrt(gx * gx + gy * gy) * 2.0)
    }
  }
  return out
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

  // 1. Grayscale luminosity
  const gray = new Float32Array(width * height)
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4] / 255
    const g = data[i * 4 + 1] / 255
    const b = data[i * 4 + 2] / 255
    gray[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  // 2. Gamma correction
  const gammaMap = new Float32Array(width * height)
  for (let i = 0; i < gray.length; i++) {
    gammaMap[i] = Math.pow(gray[i], 1.0 / gamma)
  }

  // 3. Unsharp mask
  const sharpened = unsharpMask(gammaMap, width, height, 0.65)

  postMessage({ type: 'progress', value: 0.20 })

  // 4. Stretch contrasto
  let minV = Infinity, maxV = -Infinity
  for (let i = 0; i < sharpened.length; i++) {
    if (sharpened[i] < minV) minV = sharpened[i]
    if (sharpened[i] > maxV) maxV = sharpened[i]
  }
  const range = maxV - minV || 1
  for (let i = 0; i < sharpened.length; i++) {
    sharpened[i] = (sharpened[i] - minV) / range
  }

  // 5. Edge detection (Sobel) per outline punti
  const blurredForEdge = boxBlur(sharpened, width, height, 1)
  const edges = sobelEdges(blurredForEdge, width, height)

  postMessage({ type: 'progress', value: 0.35 })

  // ── Step B: Campionamento ──────────────────────────────────────────────────
  const rand = mulberry32(seed)

  const [cw, ch, cd] = crystalDims
  const innerW = cw - padding * 2
  const innerH = ch - padding * 2
  const innerD = cd - padding * 2
  const depthClamped = Math.min(depthRange, innerD * 0.88)

  const scaledMax = Math.floor(maxPoints * density)

  // Downsample a 320×320 max per performance
  const SAMPLE_W = Math.min(width,  320)
  const SAMPLE_H = Math.min(height, 320)
  const xRatio   = width  / SAMPLE_W
  const yRatio   = height / SAMPLE_H

  // Raccogli pesi: intensità + 35% bordi
  const weights:  number[]        = []
  const edgeWts:  number[]        = []
  const coords:   [number, number][] = []

  for (let sy = 0; sy < SAMPLE_H; sy++) {
    for (let sx = 0; sx < SAMPLE_W; sx++) {
      const px = Math.floor(sx * xRatio)
      const py = Math.floor(sy * yRatio)
      const idx = py * width + px
      const intensity = sharpened[idx]
      const edge      = edges[idx]

      // Combina: zona scura ma con bordo forte → includi comunque
      const combinedWeight = intensity * 0.75 + edge * 0.25

      if (combinedWeight > threshold) {
        weights.push(intensity)
        edgeWts.push(edge)
        coords.push([sx / SAMPLE_W, sy / SAMPLE_H])
      }
    }
  }

  postMessage({ type: 'progress', value: 0.50 })

  // ── Step C: Generazione punti 3D ──────────────────────────────────────────
  const positions:   number[] = []
  const intensities: number[] = []

  // Riserva ~15% dei punti per bordi netti (definizione struttura)
  const edgeBudget    = Math.floor(scaledMax * 0.18)
  const normalBudget  = scaledMax - edgeBudget

  // Ordina per edge strength (decrescente) per prioritizzare bordi
  const edgeIndices = coords
    .map((_, i) => i)
    .sort((a, b) => edgeWts[b] - edgeWts[a])

  // Punti di bordo (outline nitido)
  let edgeCount = 0
  for (const i of edgeIndices) {
    if (edgeCount >= edgeBudget) break
    if (edgeWts[i] < 0.15) break  // solo bordi forti

    const [u, v] = coords[i]
    const w      = weights[i]

    const jx = (rand() - 0.5) * (0.6 / SAMPLE_W)
    const jy = (rand() - 0.5) * (0.6 / SAMPLE_H)

    const sceneX = (u + jx - 0.5) * innerW
    const sceneY = -(v + jy - 0.5) * innerH

    // Bordi sulla superficie frontale del cristallo (z positivo = davanti)
    const depthFactor = 0.75 + rand() * 0.25  // zona frontale
    const sceneZ = (depthFactor - 0.5) * depthClamped * 0.4 + (rand() - 0.5) * 0.06

    const halfW = innerW / 2, halfH = innerH / 2, halfD = innerD / 2
    if (Math.abs(sceneX) < halfW && Math.abs(sceneY) < halfH && Math.abs(sceneZ) < halfD) {
      positions.push(sceneX, sceneY, sceneZ)
      intensities.push(Math.min(1, w * 1.3 + 0.15))  // bordi sempre luminosi
      edgeCount++
    }
  }

  postMessage({ type: 'progress', value: 0.65 })

  // Punti normali (volume interno)
  for (let i = 0; i < weights.length && positions.length / 3 < normalBudget + edgeBudget; i++) {
    const w      = weights[i]
    const [u, v] = coords[i]
    const k      = Math.max(1, Math.round(w * 4 * density))

    for (let j = 0; j < k && positions.length / 3 < scaledMax; j++) {
      const jx = (rand() - 0.5) * (1.2 / SAMPLE_W)
      const jy = (rand() - 0.5) * (1.2 / SAMPLE_H)

      const sceneX = (u + jx - 0.5) * innerW
      const sceneY = -(v + jy - 0.5) * innerH

      let sceneZ: number
      if (depthMode === 'GRAYSCALE_2_5D') {
        // chiaro → superficiale (z alto), scuro → profondo
        const depthFactor = 1.0 - w
        sceneZ = (depthFactor - 0.5) * depthClamped + (rand() - 0.5) * 0.1
      } else {
        sceneZ = (rand() - 0.5) * depthClamped
      }

      const halfW = innerW / 2, halfH = innerH / 2, halfD = innerD / 2
      if (Math.abs(sceneX) < halfW && Math.abs(sceneY) < halfH && Math.abs(sceneZ) < halfD) {
        positions.push(sceneX, sceneY, sceneZ)
        intensities.push(w)
      }
    }
  }

  postMessage({ type: 'progress', value: 0.92 })

  const posArray = new Float32Array(positions)
  const intArray = new Float32Array(intensities)

  postMessage(
    { type: 'result', positions: posArray, intensities: intArray, count: posArray.length / 3 },
    { transfer: [posArray.buffer, intArray.buffer] }
  )

  postMessage({ type: 'progress', value: 1.0 })
}
