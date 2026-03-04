/**
 * Hook LOD - Level of Detail automatico
 * Riduce punti visibili su device low-end o zoom-out
 */
import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'

export function useLOD() {
  const { gl } = useThree()
  const tierRef = useRef<'low' | 'mid' | 'high'>('mid')

  useEffect(() => {
    // Stima tier del device da renderer capabilities
    const renderer = gl
    const { maxTextureSize } = renderer.capabilities

    let tier: 'low' | 'mid' | 'high'
    if (maxTextureSize <= 4096) {
      tier = 'low'
    } else if (maxTextureSize <= 8192) {
      tier = 'mid'
    } else {
      tier = 'high'
    }

    // Check se mobile (heuristic)
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      window.innerWidth < 768

    if (isMobile && tier === 'high') tier = 'mid'
    if (isMobile && tier === 'mid') tier = 'low'

    tierRef.current = tier
    console.debug('[LOD] tier:', tier, '| maxTexSize:', maxTextureSize)
  }, [gl])

  return tierRef.current
}

/**
 * Calcola il numero massimo di punti da renderare in base al tier
 */
export function getLODPointLimit(tier: 'low' | 'mid' | 'high', total: number): number {
  const limits: Record<'low' | 'mid' | 'high', number> = {
    low: 50_000,
    mid: 150_000,
    high: 400_000,
  }
  return Math.min(total, limits[tier])
}
