import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Float } from "@react-three/drei";
import * as THREE from "three";
import brainModelUrl from "../assets/brain.glb?url";

function SolidBrain({ mouse }) {
  const group = useRef();
  const { scene } = useGLTF(brainModelUrl);

  const containerGroup = useMemo(() => {
    const s = scene.clone(true);
    
    // Measure bounding box of the solid anatomical brain model
    const box = new THREE.Box3().setFromObject(s);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // Shift model so its anatomical center is at [0,0,0]
    s.position.sub(center);

    // Normalize size so it fills the viewport nicely (target size ~ 3.4 units)
    const maxDim = Math.max(size.x, size.y, size.z);
    const targetSize = 3.4;
    const scaleFactor = maxDim > 0 ? targetSize / maxDim : 1;

    const wrapper = new THREE.Group();
    wrapper.add(s);
    wrapper.scale.set(scaleFactor, scaleFactor, scaleFactor);

    // Enhance materials for realistic lighting and organic depth
    s.traverse((child) => {
      if (child.isMesh && child.material) {
        // Organic pinkish-purple soft matte brain finish with realistic lighting response
        child.material.roughness = 0.45;
        child.material.metalness = 0.05;
      }
    });

    return wrapper;
  }, [scene]);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    
    // Continuous 3D rotation with subtle tilt and interactive cursor movement
    group.current.rotation.y = t * 0.25 + mouse.current.x * 0.35;
    group.current.rotation.x = Math.sin(t * 0.4) * 0.1 + mouse.current.y * 0.2;
  });

  return (
    <group ref={group}>
      <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.4}>
        <primitive object={containerGroup} />
      </Float>
    </group>
  );
}

useGLTF.preload(brainModelUrl);

export default function HeroScene() {
  const mouse = useRef({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouse.current.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    mouse.current.y = ((e.clientY - rect.top) / rect.height - 0.5) * -2;
  };

  return (
    <div
      style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
      onMouseMove={handleMouseMove}
    >
      <Canvas
        camera={{ position: [0, 0, 6.5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent", pointerEvents: "none" }}
        dpr={[1, 1.5]}
      >
        {/* Studio Lighting Setup for Anatomical 3D Mesh */}
        <ambientLight intensity={1.2} />
        <directionalLight position={[8, 12, 8]} intensity={2.0} color="#ffffff" />
        <directionalLight position={[-8, -6, -6]} intensity={1.0} color="#A78BFA" />
        <directionalLight position={[0, -10, 5]} intensity={0.6} color="#2DD4BF" />
        <pointLight position={[0, 0, 8]} intensity={1.2} color="#ffffff" />
        
        <Suspense fallback={null}>
          <SolidBrain mouse={mouse} />
        </Suspense>
      </Canvas>
    </div>
  );
}

