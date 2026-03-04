import React, { useRef, useCallback, Suspense, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
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
  Vignette,
} from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { useStore } from '../store/useStore'
import {
  CrystalMesh,
  CrystalBackface,
  CrystalEdgeGlow,
  CrystalPedestal,
  StudioBackdrop,
  EngravingPointCloud,
  SceneLights,
} from './CrystalScene'

// ── Screenshot helper ─────────────────────────────────────────────────────────
function ScreenshotCapture({ onCapture }: { onCapture: (url: string) => void }) {
  const { gl } = useThree()
  useEffect(() => {
    const timer = setTimeout(() => {
      const url = gl.domElement.toDataURL('image/png', 1.0)
      onCapture(url)
    }, 500)
    return () => clearTimeout(timer)
  }, [gl, onCapture])
  return null
}

// ── Camera intro animation ────────────────────────────────────────────────────
function CameraIntro() {
  const { camera } = useThree()
  const t    = useRef(0)
  const done = useRef(false)

  useFrame((_, delta) => {
    if (done.current) return
    t.current += delta * 0.55
    const progress = Math.min(t.current, 1)
    const ease = 1 - Math.pow(1 - progress, 3)  // easeOutCubic

    camera.position.z = 20 + (13 - 20) * ease
    camera.position.y = 2.5 * (1 - ease) + 0.5

    if (progress >= 1) done.current = true
  })

  return null
}

// ── PostProcessing premium ────────────────────────────────────────────────────
function PostFX() {
  const glow = useStore((s) => s.params.glow)

  return (
    <EffectComposer multisampling={4}>
      {/* Bloom calibrato – soglia alta per non sovraesporre */}
      <Bloom
        intensity={glow * 0.45}
        luminanceThreshold={0.55}
        luminanceSmoothing={0.4}
        mipmapBlur
        radius={0.35}
        levels={6}
      />
      {/* Aberrazione cromatica leggera (effetto prisma cristallo) */}
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={new THREE.Vector2(0.0007, 0.0005) as any}
        radialModulation={false}
        modulationOffset={0}
      />
      {/* Vignette elegante */}
      <Vignette
        offset={0.28}
        darkness={0.6}
        blendFunction={BlendFunction.NORMAL}
      />
      {/* Tone mapping cinematografico */}
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
  const isHQ           = useStore((s) => s.isHQRendering)

  const handleScreenshot = useCallback((url: string) => {
    const a = document.createElement('a')
    a.href = url
    a.download = 'crystal-incisione.png'
    a.click()
    setHQRendering(false)
  }, [setHQRendering])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, 0.5, 20], fov: 32, near: 0.1, far: 200 }}
        gl={{
          antialias:            true,
          alpha:                false,
          powerPreference:      'high-performance',
          preserveDrawingBuffer: isHQ,
          toneMapping:          THREE.ACESFilmicToneMapping,
          toneMappingExposure:  1.12,
        }}
        dpr={[1, 1.5]}
        performance={{ min: 0.45 }}
        style={{
          background: 'radial-gradient(ellipse 75% 55% at 50% 40%, #0c1628 0%, #060d1c 50%, #020509 100%)',
        }}
      >
        <Suspense fallback={null}>
          {/* Luci studiose */}
          <SceneLights />

          {/* Ambiente HDRI studio (warehouse = neutro con riflessi morbidi) */}
          <Environment
            preset="warehouse"
            environmentIntensity={0.55}
            backgroundBlurriness={1}
          />

          {/* Fondale e pavimento studio */}
          <StudioBackdrop />

          {/* Cristallo */}
          <CrystalBackface />
          <CrystalMesh />
          <CrystalEdgeGlow />

          {/* Nuvola di punti incisa */}
          <EngravingPointCloud />

          {/* Base/Piedistallo illuminato */}
          <CrystalPedestal />

          {/* Ombra morbida */}
          <ContactShadows
            position={[0, -4.5, 0]}
            opacity={0.55}
            scale={18}
            blur={4}
            far={10}
            color="#040810"
          />

          {/* Post-processing premium */}
          <PostFX />

          {/* Animazione camera intro */}
          <CameraIntro />

          {/* Screenshot HQ */}
          {isHQ && <ScreenshotCapture onCapture={handleScreenshot} />}
        </Suspense>

        <OrbitControls
          enableZoom
          enablePan={false}
          enableDamping
          dampingFactor={0.05}
          minDistance={3.5}
          maxDistance={28}
          autoRotate
          autoRotateSpeed={0.45}
          minPolarAngle={Math.PI * 0.12}
          maxPolarAngle={Math.PI * 0.82}
          touches={{
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_ROTATE,
          }}
        />
      </Canvas>
    </div>
  )
}
