import React, { useRef, useCallback, Suspense } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import {
  OrbitControls,
  Environment,
  ContactShadows,
} from '@react-three/drei'
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  ToneMapping,
} from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { useStore } from '../store/useStore'
import {
  CrystalMesh,
  CrystalBackface,
  CrystalEdgeGlow,
  EngravingPointCloud,
  SceneLights,
} from './CrystalScene'

// ── Screenshot helper ─────────────────────────────────────────────────────────
function ScreenshotCapture({ onCapture }: { onCapture: (url: string) => void }) {
  const { gl } = useThree()
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const url = gl.domElement.toDataURL('image/png', 1.0)
      onCapture(url)
    }, 300)
    return () => clearTimeout(timer)
  }, [gl, onCapture])
  return null
}

// ── PostProcessing ─────────────────────────────────────────────────────────
function PostFX() {
  const glow = useStore((s) => s.params.glow)

  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={glow * 0.8}
        luminanceThreshold={0.15}
        luminanceSmoothing={0.5}
        mipmapBlur
        radius={0.45}
        levels={7}
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={new THREE.Vector2(0.0010, 0.0007) as any}
        radialModulation={false}
        modulationOffset={0}
      />
      <ToneMapping
        blendFunction={BlendFunction.NORMAL}
        mode={ToneMappingMode.ACES_FILMIC}
      />
    </EffectComposer>
  )
}

// ── Viewer principale ─────────────────────────────────────────────────────────
export default function CrystalViewer() {
  const setHQRendering = useStore((s) => s.setHQRendering)
  const isHQ = useStore((s) => s.isHQRendering)

  const handleScreenshot = useCallback((url: string) => {
    const a = document.createElement('a')
    a.href = url
    a.download = 'crystal-preview.png'
    a.click()
    setHQRendering(false)
  }, [setHQRendering])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 0, 12], fov: 35, near: 0.1, far: 100 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: isHQ,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        shadows
        dpr={[1, 1.5]}
        performance={{ min: 0.5 }}
        style={{
          background: 'radial-gradient(ellipse at center, #0d1828 0%, #06090f 70%, #020305 100%)',
        }}
      >
        <Suspense fallback={null}>
          <SceneLights />

          <Environment
            preset="studio"
            environmentIntensity={0.9}
          />

          {/* Cristallo */}
          <CrystalBackface />
          <CrystalMesh />
          <CrystalEdgeGlow />

          {/* Incisione */}
          <EngravingPointCloud />

          {/* Ombra a pavimento */}
          <ContactShadows
            position={[0, -4, 0]}
            opacity={0.35}
            scale={10}
            blur={2.5}
            far={6}
            color="#203060"
          />

          <PostFX />

          {isHQ && <ScreenshotCapture onCapture={handleScreenshot} />}
        </Suspense>

        <OrbitControls
          enableZoom
          enablePan={false}
          enableDamping
          dampingFactor={0.06}
          minDistance={4}
          maxDistance={22}
          autoRotate
          autoRotateSpeed={0.6}
          touches={{
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_ROTATE,
          }}
        />
      </Canvas>
    </div>
  )
}
