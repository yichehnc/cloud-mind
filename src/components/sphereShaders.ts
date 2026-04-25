import { useMemo } from 'react';
import * as THREE from 'three';

export const sphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;
  
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const sphereFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;
  
  uniform vec3 uColor;
  uniform float uTime;
  
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);
    
    // Fresnel effect for a glowing rim
    float fresnel = pow(1.0 - dot(normal, viewDir), 2.0);
    
    // Subtle pulse
    float pulse = sin(uTime * 2.0) * 0.1 + 0.9;
    
    vec3 baseColor = uColor * pulse;
    vec3 finalColor = mix(baseColor, vec3(1.0), fresnel * 0.5);
    
    gl_FragColor = vec4(finalColor, 0.82);
  }
`;
