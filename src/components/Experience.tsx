import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, PerspectiveCamera, Environment, Trail } from '@react-three/drei';
import * as THREE from 'three';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
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
  const meshRef = useRef<THREE.Mesh>(null);
  
  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color(sphere.color) },
    uTime: { value: 0 }
  }), [sphere.color]);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.copy(sphere.pos);
      // @ts-ignore
      meshRef.current.material.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <Trail
      width={sphere.size * 0.8}
      length={6}
      color={new THREE.Color(sphere.color)}
      attenuation={(t) => t * 0.8}
    >
      <mesh ref={meshRef}>
        <sphereGeometry args={[sphere.size, 32, 32]} />
        <shaderMaterial
          vertexShader={sphereVertexShader}
          fragmentShader={sphereFragmentShader}
          uniforms={uniforms}
          transparent
        />
      </mesh>
    </Trail>
  );
};

const Simulation = ({ spheres, isRunning }: { spheres: Map<string, LocalSphere>, isRunning: boolean }) => {
  useFrame((state, delta) => {
    if (!isRunning) return;

    const sphereList = Array.from(spheres.values());
    const friction = Math.max(0.985, 1.0 - sphereList.length * 0.00015);
    
    for (const s of sphereList) {
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

const Experience = ({ isRunning }: { isRunning: boolean }) => {
  const [localSpheres, setLocalSpheres] = useState<Map<string, LocalSphere>>(new Map());

  useEffect(() => {
    const q = query(collection(db, 'spheres'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLocalSpheres(prev => {
        const next = new Map(prev);
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data() as SphereData;
          if (change.type === 'added') {
            if (!next.has(change.doc.id)) {
              next.set(change.doc.id, {
                ...data,
                id: change.doc.id,
                pos: new THREE.Vector3(data.x, data.y, data.z),
                vel: new THREE.Vector3(data.vx, data.vy, data.vz)
              });
            }
          } else if (change.type === 'removed') {
            next.delete(change.doc.id);
          }
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
        
        <Simulation spheres={localSpheres} isRunning={isRunning} />
        
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <Environment preset="night" />
        
        <mesh>
          <boxGeometry args={[BOUNDS * 2 + RADIUS * 2, BOUNDS * 2 + RADIUS * 2, BOUNDS * 2 + RADIUS * 2]} />
          <meshStandardMaterial color="#ffffff" wireframe transparent opacity={0.05} />
        </mesh>
      </Canvas>
    </div>
  );
};

export default Experience;
