/**
 * WebWorker: Image Processing Pipeline → Point Cloud
 * v3 – Layered Sheet Sampling (Cockpit3D-style 2.5D)
 *
 * Algoritmo principale: "Scultura a strati"
 * ─────────────────────────────────────────
 * Invece di punti casuali nel volume, generiamo N layer Z discreti.
 * Per ogni layer Z (da -depthRange/2 a +depthRange/2):
 *   • Calcoliamo una "maschera attiva" per quel layer basata sulla depth map
 *   • Distribuiamo punti ad alta densità nella maschera
 *   • Risultato: nuvola densa che sembra una scultura solida, non punti sparsi
 *
 * Depth map sintetica (da immagine 2D):
 *   • Bright areas  → superficie frontale (z alto, vicino allo spettatore)
 *   • Dark/edge areas → superficie posteriore (z basso, lontano)
 *   • Silhouette mask → bordi precisi
 */

export interface WorkerInput {
  imageData:   ImageDataTransfer
  crystalDims: [number, number, number]
  padding:     number
  density:     number
  depthRange:  number
  threshold:   number
  gamma:       number
  depthMode:   'JITTER' | 'GRAYSCALE_2_5D'
  seed:        number
  maxPoints:   number
}

export interface ImageDataTransfer {
  data:   Uint8ClampedArray
  width:  number
  height: number
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

// ── Box blur separabile O(n) ─────────────────────────────────────────────────
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const dst = new Float32Array(w * h)
  const inv = 1 / (2 * r + 1)
  for (let y = 0; y < h; y++) {
    let sum = 0
    for (let x = 0; x < 2 * r + 1; x++) sum += src[y * w + Math.min(x, w - 1)]
    for (let x = 0; x < w; x++) {
      dst[y * w + x] = sum * inv
      sum -= src[y * w + Math.max(0, x - r)]
      sum += src[y * w + Math.min(w - 1, x + r + 1)]
    }
  }
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

// ── Sobel edges ───────────────────────────────────────────────────────────────
function sobelEdges(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const tl = src[(y-1)*w+(x-1)], tc = src[(y-1)*w+x], tr = src[(y-1)*w+(x+1)]
      const ml = src[y*w+(x-1)],                           mr = src[y*w+(x+1)]
      const bl = src[(y+1)*w+(x-1)], bc = src[(y+1)*w+x], br = src[(y+1)*w+(x+1)]
      const gx = (-tl + tr - 2*ml + 2*mr - bl + br)
      const gy = (-tl - 2*tc - tr + bl + 2*bc + br)
      out[y*w+x] = Math.min(1, Math.sqrt(gx*gx + gy*gy) * 2.2)
    }
  }
  return out
}

// ── Genera depth map sintetica da immagine 2D ─────────────────────────────────
// Combina luminosità + edge distance per creare l'illusione di profondità 3D
function buildDepthMap(
  gray:  Float32Array,
  edges: Float32Array,
  w: number, h: number
): Float32Array {
  // Calcola distance transform approssimato dall'interno della silhouette
  // (distanza dal bordo → zone centrali hanno più "profondità")
  const silhouette = new Float32Array(w * h)
  for (let i = 0; i < gray.length; i++) {
    silhouette[i] = gray[i] > 0.15 ? 1.0 : 0.0
  }

  // Blur della silhouette come proxy del distance transform
  const distApprox = boxBlur(silhouette, w, h, Math.floor(Math.min(w, h) * 0.06))

  // Depth = 60% distance-from-edge + 40% luminosità locale
  // Questo crea la sensazione che le zone "interne" siano più avanti
  const depth = new Float32Array(w * h)
  for (let i = 0; i < depth.length; i++) {
    const distNorm = Math.min(1, distApprox[i] * 3.5)
    depth[i] = distNorm * 0.6 + gray[i] * 0.4
  }

  return depth
}

// ── Pipeline principale ───────────────────────────────────────────────────────
self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const {
    imageData, crystalDims, padding, density,
    depthRange, threshold, gamma, depthMode, seed, maxPoints,
  } = e.data

  const { data, width, height } = imageData

  postMessage({ type: 'progress', value: 0.03 })

  // ── A1: Grayscale percettivo ───────────────────────────────────────────────
  const gray = new Float32Array(width * height)
  for (let i = 0; i < width * height; i++) {
    const r = data[i*4]/255, g = data[i*4+1]/255, b = data[i*4+2]/255
    gray[i] = 0.2126*r + 0.7152*g + 0.0722*b
  }

  // ── A2: Gamma + contrast stretch ──────────────────────────────────────────
  const gammaMap = new Float32Array(width * height)
  for (let i = 0; i < gray.length; i++) gammaMap[i] = Math.pow(gray[i], 1.0 / gamma)

  let minV = Infinity, maxV = -Infinity
  for (let i = 0; i < gammaMap.length; i++) {
    if (gammaMap[i] < minV) minV = gammaMap[i]
    if (gammaMap[i] > maxV) maxV = gammaMap[i]
  }
  const rng = maxV - minV || 1
  const stretched = new Float32Array(width * height)
  for (let i = 0; i < gammaMap.length; i++) stretched[i] = (gammaMap[i] - minV) / rng

  // ── A3: Unsharp mask per dettaglio bordi ───────────────────────────────────
  const blurred2 = boxBlur(stretched, width, height, 2)
  const sharpened = new Float32Array(width * height)
  for (let i = 0; i < stretched.length; i++) {
    sharpened[i] = Math.min(1, Math.max(0, stretched[i] + 0.55 * (stretched[i] - blurred2[i])))
  }

  postMessage({ type: 'progress', value: 0.18 })

  // ── A4: Edge detection Sobel ───────────────────────────────────────────────
  const edges = sobelEdges(boxBlur(sharpened, width, height, 1), width, height)

  // ── A5: Depth map sintetica ────────────────────────────────────────────────
  const depthMap = depthMode === 'GRAYSCALE_2_5D'
    ? buildDepthMap(sharpened, edges, width, height)
    : null   // in JITTER mode non serve

  postMessage({ type: 'progress', value: 0.32 })

  // ── B: Parametri volume ────────────────────────────────────────────────────
  const rand = mulberry32(seed)
  const [cw, ch, cd] = crystalDims
  const innerW = cw - padding * 2
  const innerH = ch - padding * 2
  const innerD = cd - padding * 2
  const maxDepth = Math.min(depthRange, innerD * 0.88)

  const scaledMax = Math.floor(maxPoints * density)

  // Downsample a 256×256 per velocità
  const SW = Math.min(width,  256)
  const SH = Math.min(height, 256)
  const xR = width  / SW
  const yR = height / SH

  // ── C: Layered Sheet Sampling ─────────────────────────────────────────────
  //
  // Strategia: invece di campionare punti uno a uno con probabilità,
  // dividiamo il volume Z in N_LAYERS e per ogni layer
  // distribuiamo una griglia densa di punti nelle zone "attive" per quel layer.
  //
  // Questo produce la stessa sensazione di scultura solida di Cockpit3D.

  const positions:   number[] = []
  const intensities: number[] = []

  if (depthMode === 'GRAYSCALE_2_5D' && depthMap !== null) {
    // ── MODO SCULTURA (2.5D) ──────────────────────────────────────────────
    // Ogni pixel ha una Z precisa dalla depth map → crea superficie continua
    // Più layer attorno alla Z principale per dare "spessore" alla scultura

    const N_LAYERS   = 28              // layer Z da back a front
    const LAYER_JITTER = maxDepth / N_LAYERS * 0.6  // jitter ±30% del passo
    const ptsPerPx   = Math.max(1, Math.round(density * 3.5))

    for (let sy = 0; sy < SH; sy++) {
      for (let sx = 0; sx < SW; sx++) {
        const px = Math.floor(sx * xR)
        const py = Math.floor(sy * yR)
        const idx = py * width + px

        const lum   = sharpened[idx]
        const edge  = edges[idx]
        const depth = depthMap[idx]

        // Soglia: escludi sfondo nero
        if (lum < threshold && edge < 0.12) continue

        // Intensità = luminosità + boost bordi
        const intensity = Math.min(1, lum * 0.8 + edge * 0.2 + 0.05)

        // Quanti layer attivi per questo pixel?
        // Pixel luminosi → layer front pesanti
        // Pixel scuri nella silhouette → layer back pesanti
        // Bordi → strato sottile di pochi layer superficiali
        const zCenter = (depth - 0.5) * maxDepth   // da -maxDepth/2 a +maxDepth/2

        // Spessore della "fetta" attiva: più lum → fetta più sottile (dettaglio), 
        //                                più scuro/bordo → fetta più spessa (riempimento)
        const sliceHalf = maxDepth * 0.12 * (1.0 - lum * 0.5)

        const nLayers = Math.max(1, Math.round((sliceHalf * 2 / maxDepth) * N_LAYERS * 0.8))

        for (let li = 0; li < nLayers; li++) {
          const t = nLayers > 1 ? li / (nLayers - 1) : 0.5
          const layerZ = zCenter - sliceHalf + t * sliceHalf * 2

          for (let pi = 0; pi < ptsPerPx; pi++) {
            if (positions.length / 3 >= scaledMax) break

            const jx = (rand() - 0.5) * (1.4 / SW)
            const jy = (rand() - 0.5) * (1.4 / SH)
            const jz = (rand() - 0.5) * LAYER_JITTER

            const u = sx / SW, v = sy / SH
            const sceneX =  (u + jx - 0.5) * innerW
            const sceneY = -(v + jy - 0.5) * innerH
            const sceneZ =  layerZ + jz

            const hW = innerW/2, hH = innerH/2, hD = innerD/2
            if (Math.abs(sceneX) < hW && Math.abs(sceneY) < hH && Math.abs(sceneZ) < hD) {
              positions.push(sceneX, sceneY, sceneZ)
              intensities.push(intensity)
            }
          }
          if (positions.length / 3 >= scaledMax) break
        }
        if (positions.length / 3 >= scaledMax) break
      }
      if (positions.length / 3 >= scaledMax) break
      if (sy % 32 === 0) {
        const prog = 0.32 + (sy / SH) * 0.55
        postMessage({ type: 'progress', value: prog })
      }
    }

  } else {
    // ── MODO JITTER (random nel volume) ──────────────────────────────────
    // Raccolta pesi
    const weights: number[] = []
    const coords:  [number, number][] = []

    for (let sy = 0; sy < SH; sy++) {
      for (let sx = 0; sx < SW; sx++) {
        const px = Math.floor(sx * xR)
        const py = Math.floor(sy * yR)
        const idx = py * width + px
        const lum  = sharpened[idx]
        const edge = edges[idx]
        const combined = lum * 0.8 + edge * 0.2
        if (combined > threshold) {
          weights.push(combined)
          coords.push([sx / SW, sy / SH])
        }
      }
    }

    for (let i = 0; i < weights.length && positions.length / 3 < scaledMax; i++) {
      const w = weights[i]
      const [u, v] = coords[i]
      const k = Math.max(1, Math.round(w * 4 * density))

      for (let j = 0; j < k && positions.length / 3 < scaledMax; j++) {
        const jx = (rand() - 0.5) * (1.2 / SW)
        const jy = (rand() - 0.5) * (1.2 / SH)
        const sceneX =  (u + jx - 0.5) * innerW
        const sceneY = -(v + jy - 0.5) * innerH
        const sceneZ =  (rand() - 0.5) * maxDepth

        const hW = innerW/2, hH = innerH/2, hD = innerD/2
        if (Math.abs(sceneX) < hW && Math.abs(sceneY) < hH && Math.abs(sceneZ) < hD) {
          positions.push(sceneX, sceneY, sceneZ)
          intensities.push(w)
        }
      }
    }
  }

  postMessage({ type: 'progress', value: 0.93 })

  const posArray = new Float32Array(positions)
  const intArray = new Float32Array(intensities)

  postMessage(
    { type: 'result', positions: posArray, intensities: intArray, count: posArray.length / 3 },
    { transfer: [posArray.buffer, intArray.buffer] }
  )

  postMessage({ type: 'progress', value: 1.0 })
}
