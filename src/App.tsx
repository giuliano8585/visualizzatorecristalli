import React, { Suspense, lazy, useState } from 'react'
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

      {/* Info badge bottom-right */}
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
          🖱 Trascina per ruotare · Scroll per zoom · Pinch su mobile
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

// ── Mobile panel toggle ────────────────────────────────────────────────────────
function MobilePanelToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      className="mobile-panel-toggle"
      onClick={onToggle}
      aria-label={open ? 'Nascondi pannello' : 'Mostra pannello configuratore'}
    >
      {open ? '▼ Nascondi' : '▲ Configura'}
    </button>
  )
}

// ── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [mobileOpen, setMobileOpen] = useState(true)

  return (
    <div className="app-root">
      {/* Viewer 3D sempre in background */}
      <ViewerSection />

      {/* Pannello configuratore */}
      <div className={`configurator-wrapper ${mobileOpen ? 'panel-open' : 'panel-closed'}`}>
        <ConfiguratorPanel />
      </div>

      {/* Toggle mobile */}
      <MobilePanelToggle
        open={mobileOpen}
        onToggle={() => setMobileOpen((v) => !v)}
      />
    </div>
  )
}
