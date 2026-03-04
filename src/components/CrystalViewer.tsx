import React, { useRef, useCallback, Suspense, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import {
  OrbitControls,
  Environment,
  ContactShadows,
  Stars,
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
  EngravingPointCloud,
  SceneLights,
} from './CrystalScene'

// ── Screenshot helper ─────────────────────────────────────────────────────────
function ScreenshotCapture({ onCapture }: { onCapture: (url: string) => void }) {
  const { gl } = useThree()
  useEffect(() => {
    const timer = setTimeout(() => {
      gl.render(gl.info as any, null as any)  // force render
      const url = gl.domElement.toDataURL('image/png', 1.0)
      onCapture(url)
    }, 400)
    return () => clearTimeout(timer)
  }, [gl, onCapture])
  return null
}

// ── Particelle ambiente (background stars) ─────────────────────────────────
function AmbientParticles() {
  return (
    <Stars
      radius={40}
      depth={20}
      count={600}
      factor={1.2}
      saturation={0.6}
      fade
      speed={0.3}
    />
  )
}

// ── Camera intro animation ────────────────────────────────────────────────────
function CameraIntro() {
  const { camera } = useThree()
  const t = useRef(0)
  const done = useRef(false)

  useFrame((_, delta) => {
    if (done.current) return
    t.current += delta * 0.6
    const progress = Math.min(t.current, 1)
    const ease = 1 - Math.pow(1 - progress, 3) // easeOutCubic

    // da z=18 a z=12
    const startZ = 18
    const endZ = 12
    camera.position.z = startZ + (endZ - startZ) * ease
    camera.position.y = 1.5 * (1 - ease)

    if (progress >= 1) done.current = true
  })

  return null
}

// ── PostProcessing ────────────────────────────────────────────────────────────
function PostFX() {
  const glow = useStore((s) => s.params.glow)

  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={glow * 0.85}
        luminanceThreshold={0.12}
        luminanceSmoothing={0.6}
        mipmapBlur
        radius={0.5}
        levels={8}
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={new THREE.Vector2(0.0009, 0.0006) as any}
        radialModulation={false}
        modulationOffset={0}
      />
      <Vignette
        offset={0.3}
        darkness={0.65}
        blendFunction={BlendFunction.NORMAL}
      />
      <ToneMapping
        blendFunction={BlendFunction.NORMAL}
        mode={ToneMappingMode.ACES_FILMIC}
      />
    </EffectComposer>
  )
}

// ── Piastra riflettente sotto il cristallo ────────────────────────────────────
function ReflectionPlane() {
  return (
    <mesh position={[0, -4.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[30, 30]} />
      <meshStandardMaterial
        color="#040810"
        roughness={0.05}
        metalness={0.3}
        transparent
        opacity={0.6}
      />
    </mesh>
  )
}

// ── Viewer principale ─────────────────────────────────────────────────────────
export default function CrystalViewer() {
  const setHQRendering = useStore((s) => s.setHQRendering)
  const isHQ = useStore((s) => s.isHQRendering)

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
        camera={{ position: [0, 1.5, 18], fov: 34, near: 0.1, far: 200 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: isHQ,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.08,
        }}
        dpr={[1, 1.5]}
        performance={{ min: 0.45 }}
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 30%, #0a1525 0%, #050b18 45%, #020408 100%)',
        }}
      >
        <Suspense fallback={null}>
          {/* Luci e ambiente */}
          <SceneLights />
          <Environment
            preset="city"
            environmentIntensity={0.7}
            backgroundBlurriness={1}
          />

          {/* Stelle di sfondo */}
          <AmbientParticles />

          {/* Cristallo con strati */}
          <CrystalBackface />
          <CrystalMesh />
          <CrystalEdgeGlow />

          {/* Nuvola di punti incisa */}
          <EngravingPointCloud />

          {/* Superficie riflettente */}
          <ReflectionPlane />

          {/* Ombra morbida - baked, non usa shadow map */}
          <ContactShadows
            position={[0, -4, 0]}
            opacity={0.45}
            scale={14}
            blur={3.5}
            far={8}
            color="#080f22"
          />

          {/* Post-processing */}
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
          dampingFactor={0.055}
          minDistance={3.5}
          maxDistance={26}
          autoRotate
          autoRotateSpeed={0.5}
          minPolarAngle={Math.PI * 0.15}
          maxPolarAngle={Math.PI * 0.85}
          touches={{
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_ROTATE,
          }}
        />
      </Canvas>
    </div>
  )
}
