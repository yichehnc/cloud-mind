import React, { useRef, useState, useEffect, useMemo, Suspense } from 'react';
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

const Sphere = ({ sphere }: { sphere: LocalSphere }) => {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color(sphere.color) },
    uTime: { value: 0 }
  }), [sphere.color]);

  useFrame((state) => {
    if (groupRef.current) groupRef.current.position.copy(sphere.pos);
    const mat = meshRef.current?.material as THREE.ShaderMaterial | undefined;
    if (mat?.uniforms?.uTime) mat.uniforms.uTime.value = state.clock.elapsedTime;
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
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <Text
          position={[0, sphere.size + 0.4, 0]}
          fontSize={0.2}
          color="white"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.01}
          outlineColor="#000000"
          fillOpacity={0.8}
          onBeforeRender={(renderer, scene, camera, geometry, material) => {
            if (meshRef.current) {
              const time = performance.now() * 0.002;
              (material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(time) * 0.2;
            }
          }}
        >
          {sphere.emotion}
        </Text>
      </group>
    </Trail>
  );
};

const Simulation = ({ spheres, isRunning, handResults }: { spheres: Map<string, LocalSphere>, isRunning: boolean, handResults: Results | null }) => {
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
        <Sphere key={s.id} sphere={s} />
      ))}
    </>
  );
};


const BoundsCube = () => {
  const ref = useRef<THREE.LineSegments>(null);
  const geo = useMemo(() => {
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(BOUNDS * 2 + 4, BOUNDS * 2 + 4, BOUNDS * 2 + 4));
    return edges;
  }, []);

  useEffect(() => {
    ref.current?.computeLineDistances();
  }, []);

  return (
    <lineSegments ref={ref} geometry={geo}>
      <lineDashedMaterial color="#ffffff" transparent opacity={0.12} dashSize={0.4} gapSize={0.4} />
    </lineSegments>
  );
};

const Experience = ({ isRunning, handResults }: { isRunning: boolean, handResults: Results | null }) => {
  const [localSpheres, setLocalSpheres] = useState<Map<string, LocalSphere>>(new Map());

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
          <Simulation spheres={localSpheres} isRunning={isRunning} handResults={handResults} />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          <Environment preset="night" />
        </Suspense>
        
        <BoundsCube />
      </Canvas>
    </div>
  );
};

export default Experience;
