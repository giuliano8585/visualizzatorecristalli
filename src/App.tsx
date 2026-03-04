import React, { Suspense, lazy } from 'react'
import ConfiguratorPanel from './components/ConfiguratorPanel'
import { useStore, CRYSTAL_PRESETS } from './store/useStore'
import './styles.css'

// Lazy load del viewer 3D per performance
const CrystalViewer = lazy(() => import('./components/CrystalViewer'))

// ── Viewer wrapper con overlay ────────────────────────────────────────────────
function ViewerSection() {
  const pointCount = useStore((s) => s.pointCount)
  const crystalType = useStore((s) => s.crystalType)
  const isHQ = useStore((s) => s.isHQRendering)
  const preset = CRYSTAL_PRESETS[crystalType]

  return (
    <div className="viewer-root">
      <Suspense fallback={
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="hq-spinner" />
        </div>
      }>
        <CrystalViewer />
      </Suspense>

      {/* Placeholder quando non c'è ancora un'incisione */}
      {pointCount === 0 && (
        <div className="viewer-placeholder">
          <div className="viewer-placeholder-icon">💎</div>
          <div className="viewer-placeholder-text">
            Carica una foto e premi<br />
            <strong style={{ color: '#4a9eff' }}>✦ Genera Cristallo</strong><br />
            per vedere l'anteprima 3D
          </div>
        </div>
      )}

      {/* Info badge */}
      {pointCount > 0 && (
        <div className="viewer-overlay">
          <div className="viewer-badge">
            💎 <strong>{preset.label}</strong>
          </div>
          <div className="viewer-badge">
            ✦ <strong>{pointCount.toLocaleString('it')}</strong> punti incisi
          </div>
        </div>
      )}

      {/* Hint controlli orbit */}
      {pointCount > 0 && (
        <div className="controls-hint">
          🖱 Trascina per ruotare • Scroll per zoom • Pinch su mobile
        </div>
      )}

      {/* HQ Overlay */}
      {isHQ && (
        <div className="hq-overlay">
          <div className="hq-spinner" />
          <div style={{ fontSize: '14px', color: '#7090b8' }}>
            Rendering HQ in corso...
          </div>
        </div>
      )}
    </div>
  )
}

// ── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <div className="app-root">
      {/* Pannello configuratore sinistro */}
      <ConfiguratorPanel />

      {/* Viewer 3D (tutto il resto) */}
      <ViewerSection />
    </div>
  )
}
