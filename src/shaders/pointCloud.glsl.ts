// Vertex shader per i punti incisi nel cristallo
// v2 – Cockpit3D-inspired: colori caldi/freddi per profondità, sparkle, diamond dust
export const pointsVertexShader = /* glsl */`
  attribute float intensity;
  attribute float randomOffset;

  varying float vIntensity;
  varying float vDepth;
  varying float vRandom;
  varying vec3  vColor;

  uniform float uPointSize;
  uniform float uTime;
  uniform float uGlow;

  // Pseudo-random hash 1D → float
  float hash1(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  void main() {
    vIntensity  = intensity;
    vRandom     = randomOffset;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float dist = length(mvPosition.xyz);

    // Profondità normalizzata [-1..1] → colore caldo/freddo
    // z negativo = più lontano dalla camera (più profondo nel cristallo)
    float depthNorm = clamp(position.z * 0.5 + 0.5, 0.0, 1.0);
    vDepth = depthNorm;

    // Palette colori tipo incisione laser reale:
    // zona profonda (back) → bianco caldo/giallino (più luce scatterata)
    // zona superficiale (front) → blu ghiaccio/azzurro
    // zone medie → bianco brillante
    vec3 deepColor    = vec3(1.00, 0.98, 0.92);  // bianco leggermente caldo
    vec3 midColor     = vec3(0.95, 0.97, 1.00);  // bianco puro
    vec3 surfColor    = vec3(0.55, 0.80, 1.00);  // azzurro ghiaccio superficie
    vec3 brightColor  = vec3(1.00, 1.00, 1.00);  // bianco puro per core

    // Mix basato su profondità
    vec3 depthColor = mix(surfColor, deepColor, depthNorm);

    // I punti molto intensi tendono verso il bianco puro (flash laser)
    vColor = mix(depthColor, brightColor, intensity * intensity * 0.8);

    // Dimensione punto: più grande in profondità (scattering) + distanza
    float sizeByDist = uPointSize * 55.0 / dist;

    // Sparkle effect: ogni frame alcuni punti scintillano
    float sparkle = 1.0;
    float sparkleSpeed = hash1(randomOffset * 127.1) * 3.0 + 1.0;
    float sparkleMask  = step(0.96, hash1(randomOffset * 311.7 + floor(uTime * sparkleSpeed)));
    sparkle = 1.0 + sparkleMask * 2.5 * intensity;

    // Pulse sottile
    float pulse = 1.0 + 0.03 * sin(uTime * 1.4 + randomOffset * 6.28318);

    // Punti più intensi = più grandi + profondità aumenta leggermente la size (scattering)
    float depthScale = 0.85 + depthNorm * 0.30;
    float finalSize = sizeByDist * intensity * pulse * sparkle * depthScale * (0.6 + intensity * 0.5);

    gl_PointSize = clamp(finalSize, 1.0, 14.0);
    gl_Position  = projectionMatrix * mvPosition;
  }
`

// Fragment shader per i punti incisi
export const pointsFragmentShader = /* glsl */`
  varying float vIntensity;
  varying float vDepth;
  varying float vRandom;
  varying vec3  vColor;

  uniform float uGlow;
  uniform float uTime;

  float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;

    // Core brillante + halo morbido (simula inclusions laser reali)
    float coreRadius   = 0.12;
    float coreMask     = 1.0 - smoothstep(0.0, coreRadius, d);
    float haloMask     = exp(-d * d * 6.5);

    // Alpha: core solido + halo trasparente
    float alpha = coreMask * 0.95 + haloMask * (0.5 - d);
    alpha *= vIntensity;

    // Colore base dalla varying (depth-driven)
    vec3 finalColor = vColor;

    // Core sempre bianco puro (flash del punto laser)
    finalColor = mix(finalColor, vec3(1.0, 1.0, 1.0), coreMask * 0.7);

    // Boost glow esterno nei punti ad alta intensità
    float glowBoost = uGlow * vIntensity * vIntensity;
    finalColor += vec3(0.2, 0.35, 0.6) * glowBoost * haloMask;

    // Diffraction rainbow faint (prisma cristallo): shift colore con angolo
    float angle = atan(uv.y, uv.x) / 6.28318 + 0.5;
    vec3 rainbow = vec3(
      0.5 + 0.5 * sin(angle * 6.28318 + 0.0),
      0.5 + 0.5 * sin(angle * 6.28318 + 2.094),
      0.5 + 0.5 * sin(angle * 6.28318 + 4.189)
    );
    finalColor = mix(finalColor, rainbow, 0.04 * vIntensity * haloMask);

    // Alpha finale con glow moltiplicatore
    float finalAlpha = alpha * mix(0.75, 1.0, uGlow * 0.4);
    finalAlpha = clamp(finalAlpha, 0.0, 1.0);

    gl_FragColor = vec4(finalColor, finalAlpha);
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
