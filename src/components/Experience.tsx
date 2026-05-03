import React, { useRef, useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, PerspectiveCamera, Environment, Trail, Text } from '@react-three/drei';
import * as THREE from 'three';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { Results } from '@mediapipe/hands';
import { db, auth, SphereData, OperationType, handleFirestoreError } from '../lib/firebase';
import { sphereVertexShader, sphereFragmentShader } from './sphereShaders';

// Bounds for our simulation box
const BOUNDS = 8;
const RADIUS = 0.5;

interface LocalSphere extends SphereData {
  id: string;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
}

type BlendConfig = {
  blending: THREE.Blending;
  blendEquation?: THREE.BlendingEquation;
  blendSrc?: THREE.BlendingSrcFactor;
  blendDst?: THREE.BlendingDstFactor;
  dissolve: boolean;
};

const DEFAULT_BLEND: BlendConfig = { blending: THREE.AdditiveBlending, dissolve: false };

// Only non-darkening modes — no subtract/multiply/difference which can produce black
const RANDOM_BLEND_CONFIGS: BlendConfig[] = [
  { blending: THREE.AdditiveBlending, dissolve: false }, // Linear Dodge
  { blending: THREE.NormalBlending,   dissolve: false }, // Luminous
  { blending: THREE.NormalBlending,   dissolve: true  }, // Dissolve
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Per-sphere randomised lifetime: 45–180 s
function getLifetime(id: string): number {
  return 45 + (hashId(id) % 136);
}

function formatTime(secs: number): string {
  const s = Math.max(0, Math.ceil(secs));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

const Sphere = ({ sphere, onExpire }: { sphere: LocalSphere; onExpire: (id: string) => void }) => {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const startRef = useRef(Date.now());
  const lastTickRef = useRef(0);
  const expiredRef = useRef(false);
  const lifetime = useMemo(() => getLifetime(sphere.id), [sphere.id]);
  const [displayTime, setDisplayTime] = useState(formatTime(lifetime));

  const blend = useMemo(() => {
    const h = hashId(sphere.id);
    return (h % 10) < 3 ? RANDOM_BLEND_CONFIGS[h % RANDOM_BLEND_CONFIGS.length] : DEFAULT_BLEND;
  }, [sphere.id]);

  const uniforms = useMemo(() => ({
    uColor:    { value: new THREE.Color(sphere.color) },
    uTime:     { value: 0 },
    uFade:     { value: 1 },
    uDissolve: { value: blend.dissolve ? 1 : 0 },
  }), [sphere.color, blend.dissolve]);

  useFrame((state) => {
    if (groupRef.current) groupRef.current.position.copy(sphere.pos);

    const now = Date.now();
    const elapsed = (now - startRef.current) / 1000;
    const remaining = Math.max(0, lifetime - elapsed);

    const mat = meshRef.current?.material as THREE.ShaderMaterial | undefined;
    if (mat?.uniforms) {
      mat.uniforms.uTime.value = state.clock.elapsedTime;
      const nearest = BOUNDS - Math.max(Math.abs(sphere.pos.x), Math.abs(sphere.pos.y), Math.abs(sphere.pos.z));
      const wallFade = Math.max(0, Math.min(1, nearest / 3));
      const timerFade = remaining < 10 ? remaining / 10 : 1;
      mat.uniforms.uFade.value = wallFade * timerFade;
    }

    // Update display once per second
    if (now - lastTickRef.current >= 1000) {
      lastTickRef.current = now;
      setDisplayTime(formatTime(remaining));
    }

    // Expire once
    if (remaining <= 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpire(sphere.id);
    }
  });

  return (
    <Trail
      width={sphere.size * 0.5}
      length={8}
      color={new THREE.Color(sphere.color)}
      attenuation={(t) => t * t * 0.4}
    >
      <group ref={groupRef}>
        <mesh ref={meshRef}>
          <sphereGeometry args={[sphere.size, 32, 32]} />
          <shaderMaterial
            vertexShader={sphereVertexShader}
            fragmentShader={sphereFragmentShader}
            uniforms={uniforms}
            transparent
            blending={blend.blending}
            blendEquation={blend.blendEquation}
            blendSrc={blend.blendSrc}
            blendDst={blend.blendDst}
            depthWrite={false}
          />
        </mesh>
        <Text
          position={[0, sphere.size + 0.35, 0]}
          fontSize={0.18}
          color="white"
          anchorX="center"
          anchorY="middle"
          fillOpacity={0.8}
          onBeforeRender={(_r, _s, _c, _g, material) => {
            const time = performance.now() * 0.002;
            (material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(time) * 0.2;
          }}
        >
          {sphere.emotion}
        </Text>
        <Text
          position={[0, 0, 0]}
          fontSize={0.2}
          color="white"
          anchorX="center"
          anchorY="middle"
          fillOpacity={0.9}
        >
          {displayTime}
        </Text>
      </group>
    </Trail>
  );
};

const Simulation = ({ spheres, isRunning, handResults, onExpire }: { spheres: Map<string, LocalSphere>, isRunning: boolean, handResults: Results | null, onExpire: (id: string) => void }) => {
  useFrame((state, delta) => {
    if (!isRunning) return;

    const sphereList = Array.from(spheres.values());
    const friction = Math.max(0.985, 1.0 - sphereList.length * 0.00015);
    
    // Hand interaction positions
    const handPoints: THREE.Vector3[] = [];
    if (handResults && handResults.multiHandLandmarks) {
      handResults.multiHandLandmarks.forEach((landmarks) => {
        const indexTip = landmarks[8];
        handPoints.push(new THREE.Vector3(
          (indexTip.x - 0.5) * -20,
          (indexTip.y - 0.5) * -15,
          (indexTip.z) * -10
        ));
      });
    }

    for (const s of sphereList) {
      // Hand pushing logic
      handPoints.forEach(hp => {
        const dist = s.pos.distanceTo(hp);
        if (dist < 3.0) {
          const force = s.pos.clone().sub(hp).normalize().multiplyScalar((3.0 - dist) * 0.1);
          s.vel.add(force);
        }
      });

      s.pos.add(s.vel.clone().multiplyScalar(delta * 60));
      
      const boundsWithRadius = BOUNDS;
      if (Math.abs(s.pos.x) > boundsWithRadius) { s.vel.x *= -0.95; s.pos.x = Math.sign(s.pos.x) * boundsWithRadius; }
      if (Math.abs(s.pos.y) > boundsWithRadius) { s.vel.y *= -0.95; s.pos.y = Math.sign(s.pos.y) * boundsWithRadius; }
      if (Math.abs(s.pos.z) > boundsWithRadius) { s.vel.z *= -0.95; s.pos.z = Math.sign(s.pos.z) * boundsWithRadius; }
      
      s.vel.multiplyScalar(friction);
    }
    
    for (let i = 0; i < sphereList.length; i++) {
      for (let j = i + 1; j < sphereList.length; j++) {
        const s1 = sphereList[i];
        const s2 = sphereList[j];
        const dist = s1.pos.distanceTo(s2.pos);
        const minDist = (s1.size + s2.size) * 1.1;
        
if (dist < minDist) {
          const collisionNormal = s1.pos.clone().sub(s2.pos).normalize();
          const overlap = minDist - dist;
          s1.pos.add(collisionNormal.clone().multiplyScalar(overlap * 0.5));
          s2.pos.sub(collisionNormal.clone().multiplyScalar(overlap * 0.5));
          
          const relativeVelocity = s1.vel.clone().sub(s2.vel);
          const velocityAlongNormal = relativeVelocity.dot(collisionNormal);
          
          if (velocityAlongNormal < 0) {
            const impulseIntensity = 1.1; // Restitution
            const impulse = collisionNormal.multiplyScalar(-impulseIntensity * velocityAlongNormal);
            s1.vel.add(impulse.clone().multiplyScalar(0.5));
            s2.vel.sub(impulse.clone().multiplyScalar(0.5));
          }
        }
      }
    }
  });

  return (
    <>
      {Array.from(spheres.values()).map((s) => (
        <Sphere key={s.id} sphere={s} onExpire={onExpire} />
      ))}
    </>
  );
};


// Portal — rectangle starting from front-bottom-left corner of cube
const PORTAL_W = 2.2;
const PORTAL_H = 3.8;

const Portal = () => {
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto';
    return () => { document.body.style.cursor = 'auto'; };
  }, [hovered]);

  const lineObj = useMemo(() => {
    const pts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(PORTAL_W, 0, 0),
      new THREE.Vector3(PORTAL_W, PORTAL_H, 0),
      new THREE.Vector3(0, PORTAL_H, 0),
      new THREE.Vector3(0, 0, 0),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    return new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#888888' }));
  }, []);

  // Update line colour on hover
  useEffect(() => {
    (lineObj.material as THREE.LineBasicMaterial).color.set(hovered ? '#ffffff' : '#888888');
  }, [hovered, lineObj]);

  return (
    // Anchor at front-bottom-left corner of cube, extend right and up
    <group position={[-(BOUNDS + 2), -(BOUNDS + 2), BOUNDS + 2]}>
      {/* Invisible hit plane */}
      <mesh
        position={[PORTAL_W / 2, PORTAL_H / 2, 0]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={() => window.open('about:blank', '_blank')}
      >
        <planeGeometry args={[PORTAL_W, PORTAL_H]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Rectangle linework */}
      <primitive object={lineObj} />
    </group>
  );
};

const BoundsCube = () => {
  const geo = useMemo(() =>
    new THREE.EdgesGeometry(new THREE.BoxGeometry(BOUNDS * 2 + 4, BOUNDS * 2 + 4, BOUNDS * 2 + 4))
  , []);

  const callbackRef = useCallback((node: THREE.LineSegments | null) => {
    if (node) node.computeLineDistances();
  }, []);

  return (
    <lineSegments ref={callbackRef} geometry={geo}>
      <lineDashedMaterial color="#ffffff" dashSize={0.6} gapSize={0.6} />
    </lineSegments>
  );
};

const Experience = ({ isRunning, handResults }: { isRunning: boolean, handResults: Results | null }) => {
  const [localSpheres, setLocalSpheres] = useState<Map<string, LocalSphere>>(new Map());

  const handleExpire = useCallback((id: string) => {
    setLocalSpheres(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'spheres'), orderBy('createdAt', 'desc'), limit(147));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLocalSpheres(prev => {
        const next = new Map(prev);
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data() as SphereData;
          if (change.type === 'added' && !next.has(change.doc.id)) {
            next.set(change.doc.id, {
              ...data,
              id: change.doc.id,
              pos: new THREE.Vector3(data.x, data.y, data.z),
              vel: new THREE.Vector3(data.vx, data.vy, data.vz),
              size: data.size || 0.5,
            });
          }
          // Ignore 'removed' — spheres persist in the scene once loaded
        });
        return next;
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'spheres');
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="w-full h-full bg-[#050505]">
      <Canvas shadows gl={{ antialias: true, alpha: true }}>
        <PerspectiveCamera makeDefault position={[0, 0, 25]} fov={50} />
        <OrbitControls enablePan={false} maxDistance={40} minDistance={10} autoRotate={isRunning} autoRotateSpeed={0.5} />
        
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <spotLight position={[-10, 20, 10]} angle={0.15} penumbra={1} intensity={2} decay={2} castShadow />
        
        <Suspense fallback={null}>
          <Simulation spheres={localSpheres} isRunning={isRunning} handResults={handResults} onExpire={handleExpire} />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          <Environment preset="night" />
        </Suspense>
        
        <BoundsCube />
        <Portal />
      </Canvas>
    </div>
  );
};

export default Experience;
