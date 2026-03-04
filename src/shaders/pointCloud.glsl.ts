// Vertex shader per i punti incisi nel cristallo
export const pointsVertexShader = /* glsl */`
  attribute float intensity;
  attribute float randomOffset;

  varying float vIntensity;
  varying float vDepth;

  uniform float uPointSize;
  uniform float uTime;
  uniform float uGlow;

  void main() {
    vIntensity = intensity;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mvPosition.z;

    // Dimensione punto: scala con intensità + distanza camera
    float dist = length(mvPosition.xyz);
    float sizeByDist = uPointSize * 60.0 / dist;

    // Pulse sottile per effetto "vivo"
    float pulse = 1.0 + 0.04 * sin(uTime * 1.2 + randomOffset * 6.28);

    gl_PointSize = clamp(sizeByDist * intensity * pulse * (0.5 + intensity * 0.5), 1.0, 12.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`

// Fragment shader per i punti incisi
export const pointsFragmentShader = /* glsl */`
  varying float vIntensity;
  varying float vDepth;

  uniform float uGlow;
  uniform vec3 uBaseColor;
  uniform float uTime;

  void main() {
    // Forma circolare morbida (sprite)
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;

    // Falloff gaussiano
    float alpha = exp(-d * d * 8.0) * vIntensity;

    // Colore: blu-bianco ghiaccio con variazione basata su intensità
    float t = vIntensity;
    vec3 coreColor = mix(
      vec3(0.4, 0.65, 1.0),   // blu chiaro (dettagli)
      vec3(0.92, 0.97, 1.0),  // quasi bianco (zone luminose)
      t * t
    );

    // Halo esterno leggermente più caldo
    vec3 haloColor = vec3(0.3, 0.55, 0.95);
    vec3 finalColor = mix(haloColor, coreColor, 1.0 - d * 2.0);

    // Boost glow sulle zone più intense
    finalColor += vec3(0.05, 0.10, 0.25) * uGlow * t * t;

    gl_FragColor = vec4(finalColor, alpha * uGlow * 0.85);
  }
`

// Vertex shader cristallo (pass-through, il materiale fisico gestisce il resto)
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
