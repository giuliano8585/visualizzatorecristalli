import { create } from 'zustand'

// ── Tipi cristallo ────────────────────────────────────────────────────────────
export type CrystalType = 'CUBE_4' | 'RECT_6x4x4' | 'RECT_8x5x5'

export interface CrystalPreset {
  id: CrystalType
  label: string
  dims: [number, number, number] // cm
  padding: number               // cm di margine interno
  maxPoints: number
  price?: string
}

export const CRYSTAL_PRESETS: Record<CrystalType, CrystalPreset> = {
  CUBE_4: {
    id: 'CUBE_4',
    label: 'Cubo 4×4×4 cm',
    dims: [4, 4, 4],
    padding: 0.35,
    maxPoints: 180_000,
    price: '€ 39',
  },
  RECT_6x4x4: {
    id: 'RECT_6x4x4',
    label: 'Rettangolo 6×4×4 cm',
    dims: [6, 4, 4],
    padding: 0.35,
    maxPoints: 250_000,
    price: '€ 49',
  },
  RECT_8x5x5: {
    id: 'RECT_8x5x5',
    label: 'Rettangolo 8×5×5 cm',
    dims: [8, 5, 5],
    padding: 0.4,
    maxPoints: 400_000,
    price: '€ 69',
  },
}

// ── Parametri incisione ───────────────────────────────────────────────────────
export interface EngravingParams {
  density: number        // 0..1  densità punti
  depthRange: number     // cm    spessore "strato incisione"
  threshold: number      // 0..1  soglia luminosità minima
  gamma: number          // 0.5..3 curve contrasto
  glow: number           // 0..2  intensità bloom
  pointSize: number      // 0.5..3 dimensione base punto
  depthMode: 'JITTER' | 'GRAYSCALE_2_5D'
  seed: number
}

export const DEFAULT_PARAMS: EngravingParams = {
  density:    0.72,          // alta densità per la scultura a strati
  depthRange: 2.0,           // cm – spessore realistico incisione laser
  threshold:  0.10,          // soglia bassa – cattura tutta la silhouette
  gamma:      1.35,
  glow:       0.85,          // bloom moderato – non sovraesporre
  pointSize:  1.2,           // punti più piccoli e densi
  depthMode:  'GRAYSCALE_2_5D',
  seed:       42,
}

// ── Stato applicazione ────────────────────────────────────────────────────────
export interface AppState {
  // configurazione
  crystalType: CrystalType
  params: EngravingParams
  // immagine
  sourceImageURL: string | null
  sourceImageData: ImageData | null
  // point cloud risultante
  pointPositions: Float32Array | null
  pointIntensities: Float32Array | null
  pointCount: number
  // UI state
  isProcessing: boolean
  processingProgress: number
  isHQRendering: boolean
  activeView: 'configurator' | 'viewer'
  showParams: boolean
  // actions
  setCrystalType: (t: CrystalType) => void
  setParams: (p: Partial<EngravingParams>) => void
  setSourceImage: (url: string, data: ImageData) => void
  clearImage: () => void
  setPointCloud: (pos: Float32Array, int: Float32Array) => void
  setProcessing: (v: boolean, progress?: number) => void
  setHQRendering: (v: boolean) => void
  setActiveView: (v: 'configurator' | 'viewer') => void
  setShowParams: (v: boolean) => void
}

export const useStore = create<AppState>((set) => ({
  crystalType: 'CUBE_4',
  params: { ...DEFAULT_PARAMS },
  sourceImageURL: null,
  sourceImageData: null,
  pointPositions: null,
  pointIntensities: null,
  pointCount: 0,
  isProcessing: false,
  processingProgress: 0,
  isHQRendering: false,
  activeView: 'configurator',
  showParams: false,

  setCrystalType: (t) => set({ crystalType: t }),
  setParams: (p) => set((s) => ({ params: { ...s.params, ...p } })),
  setSourceImage: (url, data) => set({ sourceImageURL: url, sourceImageData: data }),
  clearImage: () => set({
    sourceImageURL: null,
    sourceImageData: null,
    pointPositions: null,
    pointIntensities: null,
    pointCount: 0,
  }),
  setPointCloud: (pos, int) => set({
    pointPositions: pos,
    pointIntensities: int,
    pointCount: pos.length / 3,
    isProcessing: false,
    processingProgress: 1,
  }),
  setProcessing: (v, progress = 0) => set({ isProcessing: v, processingProgress: progress }),
  setHQRendering: (v) => set({ isHQRendering: v }),
  setActiveView: (v) => set({ activeView: v }),
  setShowParams: (v) => set({ showParams: v }),
}))
