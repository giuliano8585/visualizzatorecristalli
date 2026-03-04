import React, { useCallback, useRef, useState } from 'react'
import { useStore, CRYSTAL_PRESETS, CrystalType, DEFAULT_PARAMS } from '../store/useStore'

// ── Upload immagine ────────────────────────────────────────────────────────────
function readImageData(file: File): Promise<{ url: string; imageData: ImageData }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const MAX = 512
      const ratio = Math.min(MAX / img.width, MAX / img.height)
      const w = Math.floor(img.width * ratio)
      const h = Math.floor(img.height * ratio)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      resolve({ url, imageData: ctx.getImageData(0, 0, w, h) })
    }
    img.onerror = reject
    img.src = url
  })
}

// ── Slider con label ──────────────────────────────────────────────────────────
interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
  icon?: string
}

function ParamSlider({ label, value, min, max, step = 0.01, onChange, format, icon }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="param-row">
      <div className="param-header">
        {icon && <span className="param-icon">{icon}</span>}
        <span className="param-label">{label}</span>
        <span className="param-value">{format ? format(value) : value.toFixed(2)}</span>
      </div>
      <div className="slider-track">
        <div className="slider-fill" style={{ width: `${pct}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="slider-input"
        />
      </div>
    </div>
  )
}

// ── Selettore cristallo ────────────────────────────────────────────────────────
function CrystalSelector() {
  const crystalType = useStore((s) => s.crystalType)
  const setCrystalType = useStore((s) => s.setCrystalType)

  return (
    <div className="section">
      <h3 className="section-title">
        <span>💎</span> Formato Cristallo
      </h3>
      <div className="crystal-grid">
        {(Object.values(CRYSTAL_PRESETS)).map((preset) => (
          <button
            key={preset.id}
            onClick={() => setCrystalType(preset.id as CrystalType)}
            className={`crystal-card ${crystalType === preset.id ? 'active' : ''}`}
          >
            <CrystalIcon dims={preset.dims} active={crystalType === preset.id} />
            <div className="crystal-card-label">{preset.label}</div>
            {preset.price && (
              <div className="crystal-card-price">{preset.price}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function CrystalIcon({ dims, active }: { dims: [number, number, number]; active: boolean }) {
  const [w, h, d] = dims
  const maxD = Math.max(w, h, d)
  const sw = (w / maxD) * 36 + 8
  const sh = (h / maxD) * 28 + 6
  return (
    <svg width="52" height="44" viewBox="0 0 52 44" className="crystal-svg">
      <defs>
        <linearGradient id={`cg-${w}-${h}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={active ? '#a8d8ff' : '#6090c0'} stopOpacity="0.9" />
          <stop offset="100%" stopColor={active ? '#5090d0' : '#304060'} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <rect
        x={(52 - sw) / 2}
        y={(44 - sh) / 2}
        width={sw}
        height={sh}
        rx="3"
        fill={`url(#cg-${w}-${h})`}
        stroke={active ? '#60c0ff' : '#4a6a9a'}
        strokeWidth="1.5"
      />
      {/* riflesso */}
      <rect
        x={(52 - sw) / 2 + 3}
        y={(44 - sh) / 2 + 3}
        width={sw * 0.3}
        height={sh * 0.45}
        rx="2"
        fill="white"
        opacity="0.15"
      />
    </svg>
  )
}

// ── Upload zone ────────────────────────────────────────────────────────────────
function ImageUploader() {
  const setSourceImage = useStore((s) => s.setSourceImage)
  const clearImage = useStore((s) => s.clearImage)
  const sourceImageURL = useStore((s) => s.sourceImageURL)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return
    try {
      const { url, imageData } = await readImageData(file)
      setSourceImage(url, imageData)
    } catch (e) {
      console.error('Errore caricamento immagine', e)
    }
  }, [setSourceImage])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const onFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  if (sourceImageURL) {
    return (
      <div className="section">
        <h3 className="section-title"><span>🖼️</span> Immagine Caricata</h3>
        <div className="image-preview-wrap">
          <img src={sourceImageURL} alt="Preview" className="image-preview" />
          <button onClick={clearImage} className="btn-clear-image" aria-label="Rimuovi immagine">
            ✕
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="section">
      <h3 className="section-title"><span>📤</span> Carica Foto</h3>
      <div
        className={`drop-zone ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
        aria-label="Clicca o trascina un'immagine"
      >
        <div className="drop-icon">📸</div>
        <div className="drop-text">Clicca o trascina qui la tua foto</div>
        <div className="drop-sub">JPG, PNG, WEBP • max 20MB</div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={onFile}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  )
}

// ── Parametri avanzati ─────────────────────────────────────────────────────────
function AdvancedParams() {
  const params = useStore((s) => s.params)
  const setParams = useStore((s) => s.setParams)
  const showParams = useStore((s) => s.showParams)
  const setShowParams = useStore((s) => s.setShowParams)

  return (
    <div className="section">
      <button
        className="section-title expandable"
        onClick={() => setShowParams(!showParams)}
        aria-expanded={showParams}
      >
        <span>⚙️</span> Parametri Incisione
        <span className="expand-arrow">{showParams ? '▲' : '▼'}</span>
      </button>

      {showParams && (
        <div className="params-grid">
          <ParamSlider
            label="Densità punti"
            icon="●"
            value={params.density}
            min={0.1} max={1.0} step={0.05}
            onChange={(v) => setParams({ density: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <ParamSlider
            label="Profondità incisione"
            icon="↕"
            value={params.depthRange}
            min={0.3} max={3.0} step={0.1}
            onChange={(v) => setParams({ depthRange: v })}
            format={(v) => `${v.toFixed(1)} cm`}
          />
          <ParamSlider
            label="Soglia contrasto"
            icon="◑"
            value={params.threshold}
            min={0.0} max={0.5} step={0.01}
            onChange={(v) => setParams({ threshold: v })}
            format={(v) => v.toFixed(2)}
          />
          <ParamSlider
            label="Gamma / Curva toni"
            icon="γ"
            value={params.gamma}
            min={0.5} max={3.0} step={0.1}
            onChange={(v) => setParams({ gamma: v })}
            format={(v) => v.toFixed(1)}
          />
          <ParamSlider
            label="Dimensione punto"
            icon="⊕"
            value={params.pointSize}
            min={0.5} max={4.0} step={0.1}
            onChange={(v) => setParams({ pointSize: v })}
            format={(v) => `${v.toFixed(1)}x`}
          />
          <ParamSlider
            label="Intensità glow"
            icon="✦"
            value={params.glow}
            min={0.1} max={3.0} step={0.05}
            onChange={(v) => setParams({ glow: v })}
            format={(v) => v.toFixed(2)}
          />

          <div className="param-row">
            <div className="param-header">
              <span className="param-icon">⧩</span>
              <span className="param-label">Modalità profondità</span>
            </div>
            <div className="mode-toggle">
              <button
                className={`mode-btn ${params.depthMode === 'JITTER' ? 'active' : ''}`}
                onClick={() => setParams({ depthMode: 'JITTER' })}
              >
                Jitter
              </button>
              <button
                className={`mode-btn ${params.depthMode === 'GRAYSCALE_2_5D' ? 'active' : ''}`}
                onClick={() => setParams({ depthMode: 'GRAYSCALE_2_5D' })}
              >
                2.5D
              </button>
            </div>
          </div>

          <button
            className="btn-secondary"
            onClick={() => setParams({ ...DEFAULT_PARAMS })}
          >
            ↺ Ripristina default
          </button>
        </div>
      )}
    </div>
  )
}

// ── Barra azioni ──────────────────────────────────────────────────────────────
function ActionBar() {
  const isProcessing = useStore((s) => s.isProcessing)
  const processingProgress = useStore((s) => s.processingProgress)
  const pointCount = useStore((s) => s.pointCount)
  const sourceImageData = useStore((s) => s.sourceImageData)
  const crystalType = useStore((s) => s.crystalType)
  const params = useStore((s) => s.params)
  const setPointCloud = useStore((s) => s.setPointCloud)
  const setProcessing = useStore((s) => s.setProcessing)
  const setActiveView = useStore((s) => s.setActiveView)
  const setHQRendering = useStore((s) => s.setHQRendering)
  const activeView = useStore((s) => s.activeView)

  const workerRef = useRef<Worker | null>(null)

  const handleGenerate = useCallback(() => {
    if (!sourceImageData) return

    // Termina worker precedente
    if (workerRef.current) {
      workerRef.current.terminate()
    }

    setProcessing(true, 0)
    setActiveView('viewer')

    const preset = CRYSTAL_PRESETS[crystalType]
    const worker = new Worker(
      new URL('../workers/imageProcessor.worker.ts', import.meta.url),
      { type: 'module' }
    )
    workerRef.current = worker

    worker.onmessage = (e) => {
      const msg = e.data
      if (msg.type === 'progress') {
        setProcessing(true, msg.value)
      } else if (msg.type === 'result') {
        setPointCloud(msg.positions, msg.intensities)
        worker.terminate()
        workerRef.current = null
      }
    }

    worker.onerror = (err) => {
      console.error('Worker error', err)
      setProcessing(false)
    }

    worker.postMessage({
      imageData: {
        data: sourceImageData.data,
        width: sourceImageData.width,
        height: sourceImageData.height,
      },
      crystalDims: preset.dims,
      padding: preset.padding,
      density: params.density,
      depthRange: params.depthRange,
      threshold: params.threshold,
      gamma: params.gamma,
      depthMode: params.depthMode,
      seed: params.seed,
      maxPoints: preset.maxPoints,
    })
  }, [sourceImageData, crystalType, params, setProcessing, setPointCloud, setActiveView])

  return (
    <div className="action-bar">
      {isProcessing ? (
        <div className="progress-wrap">
          <div className="progress-label">
            Elaborazione... {Math.round(processingProgress * 100)}%
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${processingProgress * 100}%` }}
            />
          </div>
        </div>
      ) : (
        <>
          {pointCount > 0 && (
            <div className="point-count">
              ✦ {pointCount.toLocaleString('it')} punti
            </div>
          )}
          <button
            className="btn-primary"
            onClick={handleGenerate}
            disabled={!sourceImageData}
          >
            {pointCount > 0 ? '⟳ Rigenera' : '✦ Genera Cristallo'}
          </button>
          {pointCount > 0 && activeView === 'viewer' && (
            <button
              className="btn-hq"
              onClick={() => setHQRendering(true)}
              title="Salva screenshot HQ"
            >
              📷 Screenshot HQ
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ── Tab Navigation ────────────────────────────────────────────────────────────
function ViewTabs() {
  const activeView = useStore((s) => s.activeView)
  const setActiveView = useStore((s) => s.setActiveView)
  const pointCount = useStore((s) => s.pointCount)

  return (
    <div className="view-tabs">
      <button
        className={`tab ${activeView === 'configurator' ? 'active' : ''}`}
        onClick={() => setActiveView('configurator')}
      >
        ⚙ Configura
      </button>
      <button
        className={`tab ${activeView === 'viewer' ? 'active' : ''}`}
        onClick={() => setActiveView('viewer')}
        disabled={pointCount === 0}
      >
        👁 Anteprima {pointCount > 0 && <span className="tab-badge">●</span>}
      </button>
    </div>
  )
}

// ── Pannello laterale configuratore ──────────────────────────────────────────
export default function ConfiguratorPanel() {
  return (
    <div className="configurator-panel">
      <div className="panel-header">
        <div className="logo">💎 Crystal Studio</div>
        <div className="logo-sub">Configuratore Incisione 3D</div>
      </div>

      <ViewTabs />

      <div className="panel-scroll">
        <CrystalSelector />
        <ImageUploader />
        <AdvancedParams />
      </div>

      <ActionBar />
    </div>
  )
}
