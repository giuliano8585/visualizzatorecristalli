# 💎 Crystal Engraving Studio

Configuratore + Viewer 3D fotorealistico per simulare incisioni laser su cristallo a partire da un'immagine.

## 🌐 URL Applicazione
- **Dev server**: https://3000-i133nn19bpmxivn9bybwf-a402f90a.sandbox.novita.ai

## ✅ Funzionalità Implementate (MVP Sprint 1+2)

### Configuratore
- ✅ Selezione formato cristallo (3 dimensioni: 4×4×4, 6×4×4, 8×5×5 cm)
- ✅ Upload foto drag-and-drop + click (JPG, PNG, WEBP)
- ✅ Parametri incisione in tempo reale:
  - Densità punti (0–100%)
  - Profondità incisione (0.3–3.0 cm)
  - Soglia contrasto
  - Gamma/curve toni
  - Dimensione punto
  - Intensità glow/bloom
  - Modalità profondità: Jitter | 2.5D (luminosità→profondità)

### Viewer 3D
- ✅ Cristallo fotorealistico con `MeshPhysicalMaterial`:
  - Trasmissione 97%, IOR 1.52, roughness 0.025
  - Bordi smussati (RoundedBox)
  - Backface separato per rifrazione doppia
  - Edge glow sottile
- ✅ Nuvola di punti incisi con GLSL shader custom:
  - Sprite circolari morbidi
  - Blending additivo (effetto luce laser)
  - Pulse sottile animato
  - Colore blu-bianco ghiaccio con variazione per intensità
- ✅ Post-processing:
  - Bloom (glow configurabile)
  - Chromatic Aberration (dispersione cristallo)
  - Tone Mapping ACES Filmic
- ✅ Illuminazione 4 luci (key, fill, rim, back)
- ✅ Environment HDRI (studio preset)
- ✅ Contact shadows sul pavimento
- ✅ OrbitControls con auto-rotate, damping, pinch-zoom mobile

### Pipeline Immagine → Point Cloud (WebWorker)
- ✅ Processing in background (no UI freeze)
- ✅ Grayscale perceptual (sRGB weighted)
- ✅ Gamma correction
- ✅ Unsharp mask per dettaglio
- ✅ Stretch contrasto automatico
- ✅ Campionamento pesato per intensità (k punti/pixel ∝ luminosità)
- ✅ Modalità 2.5D: profondità derivata da luminosità
- ✅ Seeded PRNG per riproducibilità (Mulberry32)
- ✅ Normalizzazione su volume cristallo con padding

### Performance
- ✅ LOD automatico per device (50k/120k/350k punti)
- ✅ Buffer GPU statici (no update per frame)
- ✅ WebWorker isolato (CPU in thread separato)
- ✅ Lazy loading del viewer 3D

### UX
- ✅ Layout responsive (desktop sidebar + mobile drawer)
- ✅ Progress bar elaborazione
- ✅ Screenshot HQ (PNG download)
- ✅ Dark glass UI premium (glassmorphism)

## 🔧 Stack Tecnico
- **Frontend**: React 19 + Vite 6
- **3D**: Three.js 0.183 + React Three Fiber 9 + Drei 10
- **Post-processing**: @react-three/postprocessing 3 + postprocessing 6
- **State**: Zustand 5
- **Shader**: GLSL custom (vertex + fragment)
- **Worker**: WebWorker ES module (Vite worker)
- **Build**: Vite con chunk splitting (three-core, r3f, postfx, react)

## 📁 Struttura Progetto
```
src/
├── App.tsx                     # Root app + ViewerSection
├── main.tsx                    # Entry React
├── styles.css                  # Design system dark glass
├── store/
│   └── useStore.ts             # Zustand state (cristallo, params, pointcloud)
├── components/
│   ├── CrystalScene.tsx        # Crystal mesh + PointCloud + luci
│   ├── CrystalViewer.tsx       # Canvas R3F + PostFX + OrbitControls
│   └── ConfiguratorPanel.tsx   # UI pannello (selector, upload, sliders, actions)
├── workers/
│   └── imageProcessor.worker.ts # Pipeline img→pointcloud (WebWorker)
├── shaders/
│   └── pointCloud.glsl.ts      # Vertex + Fragment GLSL
└── lib/
    └── useLOD.ts               # LOD hook + limiti per device tier
```

## 📊 Parametri e Range

| Parametro | Range | Default | Note |
|-----------|-------|---------|------|
| density | 0.1–1.0 | 0.65 | Densità globale punti |
| depthRange | 0.3–3.0 cm | 1.6 | Spessore layer incisione |
| threshold | 0.0–0.5 | 0.12 | Soglia min luminosità |
| gamma | 0.5–3.0 | 1.4 | Gamma/curva contrasto |
| glow | 0.1–3.0 | 1.2 | Bloom intensity |
| pointSize | 0.5–4.0 | 1.4 | Dimensione base punto |
| depthMode | JITTER/2.5D | 2.5D | Modalità profondità |

## 🎯 Formati Cristallo

| Formato | Dimensioni | Padding | Max Punti | Prezzo |
|---------|-----------|---------|-----------|--------|
| CUBE_4 | 4×4×4 cm | 3.5mm | 180k | €39 |
| RECT_6x4x4 | 6×4×4 cm | 3.5mm | 250k | €49 |
| RECT_8x5x5 | 8×5×5 cm | 4.0mm | 400k | €69 |

## 🚧 Sprint 3 - Da Implementare
- [ ] HQ Path Tracing on-demand (three-gpu-pathtracer)
- [ ] ML Depth Map (MiDaS ONNX in Worker per vera profondità 3D)
- [ ] Preset look (ritratto, landscape, minimal)
- [ ] Integrazione e-commerce (carrello + ordine)
- [ ] Export configurazione JSON (seed + params per riproducibilità)
- [ ] Turntable video export (gif/mp4)
- [ ] Multi-face incisione (es. foto + testo)

## 🔧 Avvio Sviluppo
```bash
npm install
pm2 start ecosystem.config.cjs  # Dev server su porta 3000
# oppure
npm run dev
```

## 📦 Deploy Cloudflare Pages
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run build
npx wrangler pages deploy dist --project-name crystal-engraving-studio
```

## 🌍 Compatibilità Browser
- Chrome 90+ ✅
- Firefox 89+ ✅
- Safari 15+ ✅ (WebGL2 required)
- Edge 90+ ✅
- iOS Safari 15+ ⚠️ (riduzione LOD automatica)
- Android Chrome ✅ (riduzione LOD automatica)

**Requisito minimo**: WebGL2, ES2020
