export const sphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;
  varying vec4 vFragCoord;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
    vFragCoord = gl_Position;
  }
`;

export const sphereFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;

  uniform vec3 uColor;
  uniform float uTime;
  uniform float uFade;
  uniform int uDissolve;

  // 4x4 Bayer matrix for ordered dithering
  float bayer(vec2 coord) {
    int x = int(mod(coord.x, 4.0));
    int y = int(mod(coord.y, 4.0));
    int idx = x + y * 4;
    float table[16];
    table[0]  =  0.0/16.0; table[1]  =  8.0/16.0;
    table[2]  =  2.0/16.0; table[3]  = 10.0/16.0;
    table[4]  = 12.0/16.0; table[5]  =  4.0/16.0;
    table[6]  = 14.0/16.0; table[7]  =  6.0/16.0;
    table[8]  =  3.0/16.0; table[9]  = 11.0/16.0;
    table[10] =  1.0/16.0; table[11] =  9.0/16.0;
    table[12] = 15.0/16.0; table[13] =  7.0/16.0;
    table[14] = 13.0/16.0; table[15] =  5.0/16.0;
    return table[idx];
  }

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    float fresnel = pow(1.0 - dot(normal, viewDir), 3.0);
    float pulse = sin(uTime * 3.0) * 0.15 + 0.85;

    vec3 baseColor = uColor * pulse;
    vec3 finalColor = mix(baseColor, vec3(1.0), fresnel * 0.2);

    float alpha;
    if (uDissolve == 1) {
      // Dissolve: Bayer dither based on uFade — discard pixels below threshold
      float threshold = bayer(gl_FragCoord.xy);
      if (uFade < threshold) discard;
      alpha = 0.9;
    } else {
      alpha = 0.9 * uFade;
    }

    gl_FragColor = vec4(finalColor, alpha);
  }
`;
