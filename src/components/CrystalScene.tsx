import React, { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import { useStore, CRYSTAL_PRESETS } from '../store/useStore'
import { pointsVertexShader, pointsFragmentShader } from '../shaders/pointCloud.glsl'

// ── LOD limit basato su device ───────────────────────────────────────────────
function getDeviceLODLimit(): number {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768
  if (isMobile) return 60_000
  const cores = navigator.hardwareConcurrency || 4
  if (cores <= 4) return 120_000
  return 350_000
}

// ── Crystal Mesh ─────────────────────────────────────────────────────────────
export function CrystalMesh() {
  const crystalType = useStore((s) => s.crystalType)
  const preset = CRYSTAL_PRESETS[crystalType]
  const [cw, ch, cd] = preset.dims

  const meshRef = useRef<THREE.Mesh>(null!)

  // Materiale vetro/cristallo ultra-realistico
  const material = useMemo(() =>
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xd8eeff),
      transmission: 0.97,
      roughness: 0.025,
      metalness: 0.0,
      ior: 1.52,
      thickness: Math.max(cw, ch, cd) * 0.5,
      envMapIntensity: 1.8,
      reflectivity: 0.18,
      clearcoat: 0.35,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.92,
      side: THREE.FrontSide,
      depthWrite: false,
    }), [cw, ch, cd])

  useEffect(() => {
    return () => material.dispose()
  }, [material])

  return (
    <RoundedBox
      ref={meshRef}
      args={[cw, ch, cd]}
      radius={0.07}
      smoothness={6}
      castShadow
      receiveShadow
    >
      <primitive object={material} attach="material" />
    </RoundedBox>
  )
}

// ── Crystal Backface (per rifrazione più credibile) ───────────────────────────
export function CrystalBackface() {
  const crystalType = useStore((s) => s.crystalType)
  const preset = CRYSTAL_PRESETS[crystalType]
  const [cw, ch, cd] = preset.dims

  const material = useMemo(() =>
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xc0d8f8),
      transmission: 0.95,
      roughness: 0.03,
      ior: 1.52,
      thickness: Math.max(cw, ch, cd),
      envMapIntensity: 1.2,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
      depthWrite: false,
    }), [cw, ch, cd])

  return (
    <RoundedBox args={[cw, ch, cd]} radius={0.07} smoothness={6}>
      <primitive object={material} attach="material" />
    </RoundedBox>
  )
}

// ── Edge glow sottile ─────────────────────────────────────────────────────────
export function CrystalEdgeGlow() {
  const crystalType = useStore((s) => s.crystalType)
  const preset = CRYSTAL_PRESETS[crystalType]
  const [cw, ch, cd] = preset.dims
  const scale = 1.018

  return (
    <RoundedBox
      args={[cw * scale, ch * scale, cd * scale]}
      radius={0.075}
      smoothness={4}
    >
      <meshBasicMaterial
        color={new THREE.Color(0x6ab4ff)}
        transparent
        opacity={0.035}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </RoundedBox>
  )
}

// ── Point Cloud inciso ────────────────────────────────────────────────────────
export function EngravingPointCloud() {
  const pointsRef = useRef<THREE.Points>(null!)
  const matRef = useRef<THREE.ShaderMaterial>(null!)
  const positions = useStore((s) => s.pointPositions)
  const intensities = useStore((s) => s.pointIntensities)
  const glow = useStore((s) => s.params.glow)
  const pointSize = useStore((s) => s.params.pointSize)

  // LOD: limita punti su device deboli
  const lodLimit = useMemo(() => getDeviceLODLimit(), [])

  // Tronca i buffer se necessario per LOD
  const { lodPositions, lodIntensities } = useMemo(() => {
    if (!positions || !intensities) return { lodPositions: null, lodIntensities: null }
    const maxPts = lodLimit
    const totalPts = positions.length / 3
    if (totalPts <= maxPts) {
      return { lodPositions: positions, lodIntensities: intensities }
    }
    // Stride sampling per mantenere distribuzione uniforme
    const stride = Math.ceil(totalPts / maxPts)
    const newCount = Math.floor(totalPts / stride)
    const lodPos = new Float32Array(newCount * 3)
    const lodInt = new Float32Array(newCount)
    for (let i = 0; i < newCount; i++) {
      const src = i * stride
      lodPos[i * 3] = positions[src * 3]
      lodPos[i * 3 + 1] = positions[src * 3 + 1]
      lodPos[i * 3 + 2] = positions[src * 3 + 2]
      lodInt[i] = intensities[src]
    }
    return { lodPositions: lodPos, lodIntensities: lodInt }
  }, [positions, intensities, lodLimit])

  // Genera offset casuali per il pulse effect
  const randomOffsets = useMemo(() => {
    if (!lodPositions) return null
    const count = lodPositions.length / 3
    const arr = new Float32Array(count)
    for (let i = 0; i < count; i++) arr[i] = Math.random()
    return arr
  }, [lodPositions])

  const geometry = useMemo(() => {
    if (!lodPositions || !lodIntensities || !randomOffsets) return null
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(lodPositions, 3))
    geo.setAttribute('intensity', new THREE.BufferAttribute(lodIntensities, 1))
    geo.setAttribute('randomOffset', new THREE.BufferAttribute(randomOffsets, 1))
    geo.computeBoundingSphere()
    return geo
  }, [lodPositions, lodIntensities, randomOffsets])

  const material = useMemo(() =>
    new THREE.ShaderMaterial({
      vertexShader: pointsVertexShader,
      fragmentShader: pointsFragmentShader,
      uniforms: {
        uPointSize: { value: pointSize },
        uTime: { value: 0 },
        uGlow: { value: glow },
        uBaseColor: { value: new THREE.Color(0x4a90e2) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      vertexColors: false,
    }), [pointSize, glow])

  useEffect(() => {
    if (matRef.current) {
      matRef.current.uniforms.uPointSize.value = pointSize
      matRef.current.uniforms.uGlow.value = glow
    }
  }, [pointSize, glow])

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = clock.elapsedTime
    }
  })

  useEffect(() => {
    return () => {
      geometry?.dispose()
      material.dispose()
    }
  }, [geometry, material])

  if (!geometry) return null

  return (
    <points ref={pointsRef} geometry={geometry}>
      <primitive ref={matRef} object={material} attach="material" />
    </points>
  )
}

// ── Luci scena ────────────────────────────────────────────────────────────────
export function SceneLights() {
  return (
    <>
      {/* Luce ambiente diffusa */}
      <ambientLight intensity={0.3} color="#b0c8ff" />

      {/* Key light principale (top-left) */}
      <directionalLight
        position={[3, 5, 3]}
        intensity={1.8}
        color="#ffffff"
        castShadow
      />

      {/* Fill light (right, leggermente caldo) */}
      <directionalLight
        position={[-4, 2, -2]}
        intensity={0.6}
        color="#ffe8c0"
      />

      {/* Rim light (retro, blu ghiaccio) */}
      <directionalLight
        position={[0, -3, -5]}
        intensity={0.9}
        color="#60a0ff"
      />

      {/* Point light sotto per retroilluminazione cristallo */}
      <pointLight
        position={[0, -3, 0]}
        intensity={0.4}
        color="#4080ff"
        distance={12}
      />
    </>
  )
}
