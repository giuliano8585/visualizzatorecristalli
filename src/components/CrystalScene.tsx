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
  if (cores <= 4) return 150_000
  return 400_000
}

// ── Crystal Mesh – materiale fotorealistico v2 ────────────────────────────────
export function CrystalMesh() {
  const crystalType = useStore((s) => s.crystalType)
  const preset = CRYSTAL_PRESETS[crystalType]
  const [cw, ch, cd] = preset.dims

  const meshRef = useRef<THREE.Mesh>(null!)

  const material = useMemo(() =>
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xeef6ff),       // quasi trasparente con lieve tinta
      transmission: 0.98,                      // altissima trasmissione (vetro ottico)
      roughness: 0.015,                        // superficie quasi specchio
      metalness: 0.0,
      ior: 1.55,                               // IOR cristallo K9
      thickness: Math.max(cw, ch, cd) * 0.6,
      envMapIntensity: 2.2,                    // riflessi HDRI più intensi
      reflectivity: 0.22,
      clearcoat: 0.5,
      clearcoatRoughness: 0.02,
      attenuationColor: new THREE.Color(0xddeeff),
      attenuationDistance: 8.0,               // tinta azzurrina lieve in profondità
      transparent: true,
      opacity: 0.94,
      side: THREE.FrontSide,
      depthWrite: false,
    }), [cw, ch, cd])

  useEffect(() => () => material.dispose(), [material])

  return (
    <RoundedBox ref={meshRef} args={[cw, ch, cd]} radius={0.055} smoothness={8}>
      <primitive object={material} attach="material" />
    </RoundedBox>
  )
}

// ── Crystal Backface ───────────────────────────────────────────────────────────
export function CrystalBackface() {
  const crystalType = useStore((s) => s.crystalType)
  const preset = CRYSTAL_PRESETS[crystalType]
  const [cw, ch, cd] = preset.dims

  const material = useMemo(() =>
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xb8d8ff),
      transmission: 0.95,
      roughness: 0.02,
      ior: 1.55,
      thickness: Math.max(cw, ch, cd) * 1.2,
      envMapIntensity: 1.4,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
      depthWrite: false,
    }), [cw, ch, cd])

  return (
    <RoundedBox args={[cw, ch, cd]} radius={0.055} smoothness={8}>
      <primitive object={material} attach="material" />
    </RoundedBox>
  )
}

// ── Crystal Edge Glow ─────────────────────────────────────────────────────────
export function CrystalEdgeGlow() {
  const crystalType = useStore((s) => s.crystalType)
  const preset = CRYSTAL_PRESETS[crystalType]
  const [cw, ch, cd] = preset.dims

  return (
    <RoundedBox args={[cw * 1.016, ch * 1.016, cd * 1.016]} radius={0.06} smoothness={4}>
      <meshBasicMaterial
        color={new THREE.Color(0x88ccff)}
        transparent
        opacity={0.028}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </RoundedBox>
  )
}

// ── Pedestal / Base illuminata (effetto Cockpit3D) ────────────────────────────
export function CrystalPedestal() {
  const crystalType = useStore((s) => s.crystalType)
  const preset = CRYSTAL_PRESETS[crystalType]
  const [cw, _ch, cd] = preset.dims

  const pedestalW = cw * 1.15
  const pedestalD = cd * 1.15
  const pedestalH = 0.35

  // Pannello luce LED sotto (effetto lightbox)
  const lightPanelMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xd0eaff),
    emissive: new THREE.Color(0x6aacff),
    emissiveIntensity: 1.8,
    roughness: 0.3,
    metalness: 0.0,
    transparent: true,
    opacity: 0.92,
  }), [])

  // Base solida
  const baseMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x111620),
    roughness: 0.05,
    metalness: 0.7,
    reflectivity: 0.8,
    envMapIntensity: 1.5,
  }), [])

  const lightRef = useRef<THREE.Mesh>(null!)
  useFrame(({ clock }) => {
    if (lightRef.current) {
      const m = lightRef.current.material as THREE.MeshStandardMaterial
      m.emissiveIntensity = 1.6 + 0.3 * Math.sin(clock.elapsedTime * 0.8)
    }
  })

  const baseY = -(_ch / 2) - pedestalH / 2
  const lightY = -(_ch / 2) - 0.02

  return (
    <group>
      {/* Piattaforma solida scura */}
      <mesh position={[0, baseY, 0]}>
        <boxGeometry args={[pedestalW, pedestalH, pedestalD]} />
        <primitive object={baseMat} attach="material" />
      </mesh>

      {/* Pannello LED illuminato (top surface della base) */}
      <mesh ref={lightRef} position={[0, lightY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[pedestalW * 0.9, pedestalD * 0.9]} />
        <primitive object={lightPanelMat} attach="material" />
      </mesh>

      {/* Point light nascosta nella base (proietta luce verso l'alto nel cristallo) */}
      <pointLight
        position={[0, lightY + 0.1, 0]}
        intensity={3.5}
        color="#6ab8ff"
        distance={8}
        decay={2}
      />
      <pointLight
        position={[0, lightY + 0.1, 0]}
        intensity={1.2}
        color="#ffffff"
        distance={5}
        decay={2}
      />
    </group>
  )
}

// ── Backdrop studio fotografico ───────────────────────────────────────────────
export function StudioBackdrop() {
  // Fondale curvo professionale (simula sfondo studio)
  const backdropMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x0a0f1a),
    roughness: 0.95,
    metalness: 0.0,
    side: THREE.BackSide,
  }), [])

  return (
    <group>
      {/* Sfera invertita come sfondo */}
      <mesh>
        <sphereGeometry args={[45, 32, 16]} />
        <primitive object={backdropMat} attach="material" />
      </mesh>

      {/* Pannello riflettente sul pavimento */}
      <mesh position={[0, -5.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial
          color="#05080f"
          roughness={0.03}
          metalness={0.25}
          transparent
          opacity={0.75}
        />
      </mesh>

      {/* Softbox sinistro (luce calda) */}
      <mesh position={[-12, 6, 2]} rotation={[0.2, 1.0, 0]}>
        <planeGeometry args={[5, 4]} />
        <meshBasicMaterial
          color={new THREE.Color(0xfff0d8)}
          transparent
          opacity={0.06}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Softbox destro (luce fredda) */}
      <mesh position={[12, 4, -3]} rotation={[-0.1, -1.0, 0]}>
        <planeGeometry args={[5, 4]} />
        <meshBasicMaterial
          color={new THREE.Color(0xd0e8ff)}
          transparent
          opacity={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

// ── Point Cloud inciso ────────────────────────────────────────────────────────
export function EngravingPointCloud() {
  const pointsRef = useRef<THREE.Points>(null!)
  const matRef    = useRef<THREE.ShaderMaterial>(null!)
  const positions  = useStore((s) => s.pointPositions)
  const intensities = useStore((s) => s.pointIntensities)
  const glow      = useStore((s) => s.params.glow)
  const pointSize = useStore((s) => s.params.pointSize)

  const lodLimit = useMemo(() => getDeviceLODLimit(), [])

  const { lodPositions, lodIntensities } = useMemo(() => {
    if (!positions || !intensities) return { lodPositions: null, lodIntensities: null }
    const totalPts = positions.length / 3
    if (totalPts <= lodLimit) return { lodPositions: positions, lodIntensities: intensities }

    const stride = Math.ceil(totalPts / lodLimit)
    const newCount = Math.floor(totalPts / stride)
    const lodPos = new Float32Array(newCount * 3)
    const lodInt = new Float32Array(newCount)
    for (let i = 0; i < newCount; i++) {
      const src = i * stride
      lodPos[i * 3]     = positions[src * 3]
      lodPos[i * 3 + 1] = positions[src * 3 + 1]
      lodPos[i * 3 + 2] = positions[src * 3 + 2]
      lodInt[i]         = intensities[src]
    }
    return { lodPositions: lodPos, lodIntensities: lodInt }
  }, [positions, intensities, lodLimit])

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
    geo.setAttribute('position',     new THREE.BufferAttribute(lodPositions, 3))
    geo.setAttribute('intensity',    new THREE.BufferAttribute(lodIntensities, 1))
    geo.setAttribute('randomOffset', new THREE.BufferAttribute(randomOffsets, 1))
    geo.computeBoundingSphere()
    return geo
  }, [lodPositions, lodIntensities, randomOffsets])

  const material = useMemo(() =>
    new THREE.ShaderMaterial({
      vertexShader:   pointsVertexShader,
      fragmentShader: pointsFragmentShader,
      uniforms: {
        uPointSize: { value: pointSize },
        uTime:      { value: 0 },
        uGlow:      { value: glow },
        uBaseColor: { value: new THREE.Color(0x90c8ff) },
      },
      transparent:  true,
      blending:     THREE.AdditiveBlending,
      depthWrite:   false,
      depthTest:    true,
      vertexColors: false,
    }), [pointSize, glow])

  useEffect(() => {
    if (matRef.current) {
      matRef.current.uniforms.uPointSize.value = pointSize
      matRef.current.uniforms.uGlow.value      = glow
    }
  }, [pointSize, glow])

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = clock.elapsedTime
    }
  })

  useEffect(() => () => {
    geometry?.dispose()
    material.dispose()
  }, [geometry, material])

  if (!geometry) return null

  return (
    <points ref={pointsRef} geometry={geometry}>
      <primitive ref={matRef} object={material} attach="material" />
    </points>
  )
}

// ── Luci scena ─────────────────────────────────────────────────────────────────
export function SceneLights() {
  return (
    <>
      {/* Ambiente diffuso freddo */}
      <ambientLight intensity={0.18} color="#b8d4ff" />

      {/* Key light principale: top-left, bianca neutra */}
      <directionalLight
        position={[4, 7, 5]}
        intensity={2.2}
        color="#f8f4ff"
      />

      {/* Fill light: destra, leggermente calda */}
      <directionalLight
        position={[-5, 2, -3]}
        intensity={0.55}
        color="#ffe8cc"
      />

      {/* Rim light: retro basso, blu ghiaccio */}
      <directionalLight
        position={[0.5, -4, -6]}
        intensity={1.1}
        color="#5090ff"
      />

      {/* Area light frontale soffusa (simula softbox) */}
      <directionalLight
        position={[0, 0, 8]}
        intensity={0.35}
        color="#e8f0ff"
      />
    </>
  )
}
