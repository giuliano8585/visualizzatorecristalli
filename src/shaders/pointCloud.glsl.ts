// ─────────────────────────────────────────────────────────────────────────────
// Vertex shader – punti incisi nel cristallo
// Obiettivo: ogni punto = piccolo dot laser bianco/azzurro, leggibile
// NON usare AdditiveBlending con punti grandi → blob bianco
// ─────────────────────────────────────────────────────────────────────────────
export const pointsVertexShader = /* glsl */`
  attribute float intensity;
  attribute float randomOffset;

  varying float vIntensity;
  varying float vDepthNorm;
  varying float vRandom;

  uniform float uPointSize;
  uniform float uTime;

  void main() {
    vIntensity  = intensity;
    vRandom     = randomOffset;

    // Profondità normalizzata: z positivo = frontale, negativo = fondo
    // Usiamo il range effettivo del cristallo (max ~2.5 cm → scena units)
    vDepthNorm = clamp(position.z / 1.5 * 0.5 + 0.5, 0.0, 1.0);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float dist = length(mvPosition.xyz);

    // Dimensione base: piccola, mai più di 5px (punti leggibili come incisione)
    float baseSize = uPointSize * 30.0 / dist;

    // Scala con intensità ma in modo conservativo
    float sizeScale = 0.5 + intensity * 0.7;

    gl_PointSize = clamp(baseSize * sizeScale, 1.0, 5.0);
    gl_Position  = projectionMatrix * mvPosition;
  }
`

// ─────────────────────────────────────────────────────────────────────────────
// Fragment shader – dot laser preciso
// ─────────────────────────────────────────────────────────────────────────────
export const pointsFragmentShader = /* glsl */`
  varying float vIntensity;
  varying float vDepthNorm;
  varying float vRandom;

  uniform float uGlow;
  uniform float uTime;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);

    // Scarta angoli (forma circolare)
    if (d > 0.5) discard;

    // Falloff gaussiano – punto piccolo e definito
    float alpha = exp(-d * d * 18.0);
    alpha *= vIntensity;
    alpha = clamp(alpha, 0.0, 1.0);

    // Colore:
    // zona frontale (depthNorm alto) → bianco-azzurro ghiaccio
    // zona posteriore (depthNorm basso) → bianco-caldo leggermente giallino
    vec3 frontColor = vec3(0.75, 0.90, 1.00);  // azzurro chiaro
    vec3 midColor   = vec3(0.95, 0.97, 1.00);  // bianco quasi puro
    vec3 backColor  = vec3(1.00, 0.97, 0.90);  // bianco caldo

    vec3 baseColor = mix(backColor, mix(midColor, frontColor, vDepthNorm), vDepthNorm);

    // Punti molto intensi → core bianco puro
    vec3 finalColor = mix(baseColor, vec3(1.0), vIntensity * vIntensity * 0.5);

    // Glow: lieve alone colorato solo sui punti più luminosi
    float glowAlpha = alpha * uGlow * 0.3 * vIntensity;

    gl_FragColor = vec4(finalColor, alpha * 0.88 + glowAlpha);
  }
`

// Vertex shader cristallo (pass-through)
export const crystalVertexShader = /* glsl */`
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec2 vUv;

  void main() {
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vNormal = normalMatrix * normal;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
