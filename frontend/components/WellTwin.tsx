"use client";

import { OrbitControls, PerspectiveCamera, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

import type { Well } from "@/lib/data";


function PumpJack({ spm }: { spm: number }) {
  const { scene } = useGLTF("/models/sucker-rod-pump.glb");
  const rod = useRef<THREE.Mesh>(null);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      object.material = new THREE.MeshStandardMaterial({
        color: "#d6a647",
        emissive: "#2f1b04",
        emissiveIntensity: 0.18,
        metalness: 0.68,
        roughness: 0.3,
      });
    });
    return clone;
  }, [scene]);

  useFrame(({ clock }) => {
    const wave = Math.sin(clock.elapsedTime * spm * 0.42);
    if (rod.current) rod.current.position.y = 0.25 + wave * 0.24;
  });

  return (
    <group>
      <primitive
        object={model}
        position={[-0.78, 2.59, -0.13]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={0.00056}
      />
      <group position={[0, 1.7, 0]}>
        <mesh ref={rod} position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 5.2, 12]} />
          <meshStandardMaterial color="#e8f1f4" metalness={0.92} roughness={0.18} />
        </mesh>
      </group>
    </group>
  );
}

useGLTF.preload("/models/sucker-rod-pump.glb");

function FlowParticles({ well, kind }: { well: Well; kind: "steam" | "oil" }) {
  const group = useRef<THREE.Group>(null);
  const count = kind === "steam" ? 16 : Math.max(8, Math.round(well.oil_rate / 6));
  const seeds = useMemo(() => Array.from({ length: count }, (_, index) => ({
    x: ((index * 37) % 13) / 42 - 0.14,
    z: ((index * 19) % 11) / 44 - 0.12,
    offset: (index * 0.617) % 1,
  })), [count]);
  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.children.forEach((particle, index) => {
      const seed = seeds[index];
      const speed = kind === "steam" ? 0.62 : 0.35 + well.oil_rate / 280;
      const progress = (clock.elapsedTime * speed + seed.offset) % 1;
      if (kind === "steam") particle.position.y = 3.6 - progress * 9.2;
      else particle.position.y = -5.8 + progress * 9.4;
    });
  });
  const visible = kind === "steam" ? well.css_phase === "INJECTION" : well.css_phase === "PRODUCTION" || well.css_phase === "COOLING";
  if (!visible) return null;
  return (
    <group ref={group}>
      {seeds.map((seed, index) => (
        <mesh key={index} position={[seed.x, 0, seed.z]}>
          <sphereGeometry args={[kind === "steam" ? 0.055 : 0.045, 8, 8]} />
          <meshBasicMaterial color={kind === "steam" ? "#80eaff" : "#f3b64d"} transparent opacity={0.86} />
        </mesh>
      ))}
    </group>
  );
}

function Scene({ well }: { well: Well }) {
  const normalizedHeat = Math.max(0, Math.min(1, (well.reservoir_temperature - 32) / 100));
  const heatScale = well.heated_radius / 11;
  const hotColor = new THREE.Color("#ff5b31").lerp(new THREE.Color("#ffc857"), normalizedHeat);
  const alerting = well.rod_floating_risk >= 0.6;
  return (
    <>
      <color attach="background" args={["#071017"]} />
      <fog attach="fog" args={["#071017", 15, 30]} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[4, 9, 5]} intensity={2.2} color="#d9f6ff" castShadow shadow-mapSize={[1024, 1024]} />
      <hemisphereLight args={["#bcecff", "#241a12", 0.75]} />
      <pointLight position={[0, -4, 0]} intensity={18 * normalizedHeat} distance={11} color="#ff6a32" />
      <PerspectiveCamera makeDefault position={[10.5, 6.5, 14.5]} fov={44} />
      <OrbitControls makeDefault target={[0, -0.25, 0]} minDistance={8} maxDistance={28} />

      <mesh position={[0, 1.4, 0]} receiveShadow>
        <boxGeometry args={[14, 0.35, 11]} />
        <meshStandardMaterial color="#26353a" roughness={0.95} />
      </mesh>
      <gridHelper args={[14, 14, "#42616a", "#23383e"]} position={[0, 1.61, 0]} />
      <mesh position={[0, -4.35, 0]}>
        <boxGeometry args={[13.8, 3.5, 10.8]} />
        <meshStandardMaterial color="#352b24" roughness={0.96} />
      </mesh>
      <mesh position={[0, -4.35, 0]} scale={[heatScale * 1.55, heatScale * 0.72, heatScale]}>
        <sphereGeometry args={[1.65, 36, 24]} />
        <meshStandardMaterial color={hotColor} transparent opacity={0.18 + normalizedHeat * 0.2} emissive={hotColor} emissiveIntensity={0.7} depthWrite={false} />
      </mesh>
      <mesh position={[0, -3.9, 0]}>
        <cylinderGeometry args={[0.38, 0.38, 10.6, 24]} />
        <meshStandardMaterial color="#788b93" metalness={0.78} roughness={0.27} />
      </mesh>
      <mesh position={[0, -3.9, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 10.7, 24]} />
        <meshStandardMaterial color="#142129" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, -5.95, 0]}>
        <cylinderGeometry args={[0.47, 0.4, 1.3, 18]} />
        <meshStandardMaterial color={alerting ? "#ff4f4f" : "#d8a943"} emissive={alerting ? "#8b1010" : "#3a2604"} />
      </mesh>
      <Suspense fallback={null}>
        <PumpJack spm={well.spm} />
      </Suspense>
      <FlowParticles well={well} kind="steam" />
      <FlowParticles well={well} kind="oil" />

    </>
  );
}

export default function WellTwin({ well, compact = false }: { well: Well; compact?: boolean }) {
  return (
    <div className={`twin-shell ${compact ? "compact" : ""}`}>
      <div className="twin-hud">
        <div><span className="eyebrow">LIVE DIGITAL TWIN</span><strong>{well.well_id}</strong></div>
        <div className="phase-pill"><i className={well.css_phase.toLowerCase()} /> {well.css_phase}</div>
      </div>
      <Canvas dpr={[1, 1.5]} gl={{ antialias: true }} shadows>
        <Scene well={well} />
      </Canvas>
      <div className="twin-data-tags">
        <div className="twin-tag heat-tag"><span /> {well.reservoir_temperature.toFixed(0)}°C · {well.oil_viscosity.toFixed(0)} cP</div>
        {well.rod_floating_risk >= 0.6 && <div className="twin-tag risk-tag">⚠ Rod float {Math.round(well.rod_floating_risk * 100)}%</div>}
      </div>
      <div className="twin-legend"><span>DRAG TO ROTATE</span><span>SCROLL TO ZOOM</span><span>HEAT RADIUS {well.heated_radius.toFixed(1)} m</span></div>
    </div>
  );
}
